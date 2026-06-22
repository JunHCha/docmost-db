import { QueryClient, QueryKey } from "@tanstack/react-query";
import { IPage } from "@/features/page/types/page.types.ts";
import {
  IDatabaseProperty,
  IDatabasePropertyValue,
  IDatabaseRow,
  IDatabaseView,
  IFilterCondition,
  ISortCondition,
} from "@/features/database/types/database.types.ts";

// Info is looked up by the entry pageId, not the databaseId, so it gets its
// own namespace to avoid colliding with the ["database", databaseId] slot (§6).
export function databaseInfoKey(pageId: string): QueryKey {
  return ["database-info", pageId];
}

// The inline embed (issue #24) only carries the databaseId, not the entry
// pageId, so it resolves info by databaseId under its own namespace — distinct
// from the pageId-keyed slot above so the two lookups never collide (§6).
export function databaseInfoByIdKey(databaseId: string): QueryKey {
  return ["database-info-by-id", databaseId];
}

// Space-scoped list of databases (used by the relation target picker, §6).
export function databasesKey(spaceId: string): QueryKey {
  return ["databases", spaceId];
}

export function databasePropertiesKey(databaseId: string): QueryKey {
  return ["database-properties", databaseId];
}

// Row-creation templates (issue #91) are scoped to a database, mirroring the
// properties key. Not embed-scoped — templates are shared across every scope.
export function templatesKey(databaseId: string): QueryKey {
  return ["database-templates", databaseId];
}

// Views are scoped per embed (issue #39): the original database and each inline
// embed own a distinct set of views. embedId rides as a trailing slot so the
// original scope (embedId omitted) keys ["database-views", databaseId, null].
// Rows are intentionally NOT embed-scoped — every scope shares the same row data.
export function databaseViewsKey(databaseId: string, embedId?: string): QueryKey {
  return ["database-views", databaseId, embedId ?? null];
}

// Rows differ per view AND per active filter/sort config. The key trails a
// {filters, sorts} segment so that changing a filter is a distinct cache slot
// and React Query refetches (otherwise the 5-min staleTime + refetchOnMount:
// false in main.tsx would keep serving the stale, unfiltered result for the
// same viewId).
//
// IMPORTANT prefix contract: every segment lives *after* ["database-rows",
// databaseId], so the prefix-based patchers/invalidators below (and the bulk
// delete `removeRows` consumed by other views) keep matching every slot of a
// database via the ["database-rows", databaseId] prefix.
export function databaseRowsKey(
  databaseId: string,
  viewId: string,
  config?: { filters?: IFilterCondition[]; sorts?: ISortCondition[] },
): QueryKey {
  return [
    "database-rows",
    databaseId,
    viewId,
    { filters: config?.filters ?? [], sorts: config?.sorts ?? [] },
  ];
}

// Rows differ per view and per filter/sort config (each combination is its own
// cache slot — see databaseRowsKey), so a row may be present in some cached
// slots and absent from others. Optimistic patches still target every cached
// slot of the database via the ["database-rows", dbId] prefix; the updater is a
// no-op for slots where the row is missing.
function patchRows(
  qc: QueryClient,
  databaseId: string,
  updater: (rows: IDatabaseRow[]) => IDatabaseRow[],
) {
  qc.setQueriesData<IDatabaseRow[]>(
    { queryKey: ["database-rows", databaseId] },
    (old) => (old ? updater(old) : old),
  );
}

// Optimistically drop the given rows from every cached view of the database
// (used by bulk delete). Rows absent from a view are simply not matched.
export function removeRows(
  qc: QueryClient,
  databaseId: string,
  pageIds: string[],
) {
  const ids = new Set(pageIds);
  patchRows(qc, databaseId, (rows) =>
    rows.filter((row) => !ids.has(row.row.id)),
  );
}

export function patchRowValue(
  qc: QueryClient,
  databaseId: string,
  value: IDatabasePropertyValue,
) {
  patchRows(qc, databaseId, (rows) =>
    rows.map((row) => {
      if (row.row.id !== value.pageId) return row;
      const others = row.values.filter(
        (v) => v.propertyId !== value.propertyId,
      );
      return { ...row, values: [...others, value] };
    }),
  );
}

// Like patchRowValue but applies the value only when it is at least as recent
// as whatever is already cached (compared by the server-assigned updatedAt).
// Used when applying a *remote* edit signal (#55 Phase 2): two clients can edit
// the same cell concurrently, so the last server write must win (LWW) and a
// stale signal arriving after a newer one must not clobber it.
export function patchRowValueIfNewer(
  qc: QueryClient,
  databaseId: string,
  value: IDatabasePropertyValue,
) {
  const incoming = new Date(value.updatedAt).getTime();
  patchRows(qc, databaseId, (rows) =>
    rows.map((row) => {
      if (row.row.id !== value.pageId) return row;
      const existing = row.values.find(
        (v) => v.propertyId === value.propertyId,
      );
      if (existing && new Date(existing.updatedAt).getTime() > incoming) {
        // A newer write already won — ignore the stale signal.
        return row;
      }
      const others = row.values.filter(
        (v) => v.propertyId !== value.propertyId,
      );
      return { ...row, values: [...others, value] };
    }),
  );
}

export function removeRowValue(
  qc: QueryClient,
  databaseId: string,
  pageId: string,
  propertyId: string,
) {
  patchRows(qc, databaseId, (rows) =>
    rows.map((row) => {
      if (row.row.id !== pageId) return row;
      return {
        ...row,
        values: row.values.filter((v) => v.propertyId !== propertyId),
      };
    }),
  );
}

export function patchRowTitle(
  qc: QueryClient,
  databaseId: string,
  pageId: string,
  title: string,
) {
  patchRows(qc, databaseId, (rows) =>
    rows.map((row) =>
      row.row.id === pageId ? { ...row, row: { ...row.row, title } } : row,
    ),
  );
}

// Patches the title of the given page across *all* database-rows cache slots,
// regardless of databaseId. Used by the row-title-sync hook which only knows
// the pageId (from the WebSocket/localEmitter UpdateEvent) but not which
// database the page belongs to.
export function patchRowTitleEverywhere(
  qc: QueryClient,
  pageId: string,
  title: string,
) {
  qc.setQueriesData<IDatabaseRow[]>({ queryKey: ["database-rows"] }, (old) =>
    old?.map((row) =>
      row.row.id === pageId ? { ...row, row: { ...row.row, title } } : row,
    ) ?? old,
  );
}

export function appendRow(
  qc: QueryClient,
  databaseId: string,
  page: IPage,
  // Seed values (e.g. filter-derived initial values, #103) so the new row shows
  // up already filled and survives the active filter without a refetch.
  values: IDatabasePropertyValue[] = [],
) {
  patchRows(qc, databaseId, (rows) => [...rows, { row: page, values }]);
}

// Like appendRow but skips slots that already contain the row. Used when
// applying a *remote* row-create signal (#55 Phase 3): the receiver may already
// hold the row (e.g. from a refetch) when the signal lands, so guard against a
// duplicate. A no-op for slots where the row is absent stays an append.
export function appendRowIfAbsent(
  qc: QueryClient,
  databaseId: string,
  page: IPage,
) {
  patchRows(qc, databaseId, (rows) =>
    rows.some((row) => row.row.id === page.id)
      ? rows
      : [...rows, { row: page, values: [] }],
  );
}

export function appendProperty(
  qc: QueryClient,
  databaseId: string,
  property: IDatabaseProperty,
) {
  qc.setQueryData<IDatabaseProperty[]>(
    databasePropertiesKey(databaseId),
    (old) => {
      if (!old) return old;
      return [...old, property];
    },
  );
}

export function patchProperty(
  qc: QueryClient,
  databaseId: string,
  property: IDatabaseProperty,
) {
  qc.setQueryData<IDatabaseProperty[]>(
    databasePropertiesKey(databaseId),
    (old) => {
      if (!old) return old;
      return old.map((p) => (p.id === property.id ? property : p));
    },
  );
}

export function removeProperty(
  qc: QueryClient,
  databaseId: string,
  propertyId: string,
) {
  qc.setQueryData<IDatabaseProperty[]>(
    databasePropertiesKey(databaseId),
    (old) => {
      if (!old) return old;
      return old.filter((p) => p.id !== propertyId);
    },
  );
}

// Patch a single view in place from the server response. Used instead of
// invalidating the views query so persisting filters/sorts (or columns/name)
// does not replace the views array identity — which would otherwise retrigger
// the container's reseed effect and clobber in-flight local edits.
export function patchView(
  qc: QueryClient,
  databaseId: string,
  embedId: string | undefined,
  view: IDatabaseView,
) {
  qc.setQueryData<IDatabaseView[]>(
    databaseViewsKey(databaseId, embedId),
    (old) => {
      if (!old) return old;
      return old.map((v) => (v.id === view.id ? view : v));
    },
  );
}
