import { QueryClient, QueryKey } from "@tanstack/react-query";
import { IPage } from "@/features/page/types/page.types.ts";
import {
  IDatabaseProperty,
  IDatabasePropertyValue,
  IDatabaseRow,
  IFilterCondition,
  ISortCondition,
} from "@/features/database/types/database.types.ts";

// Info is looked up by the entry pageId, not the databaseId, so it gets its
// own namespace to avoid colliding with the ["database", databaseId] slot (§6).
export function databaseInfoKey(pageId: string): QueryKey {
  return ["database-info", pageId];
}

// Space-scoped list of databases (used by the relation target picker, §6).
export function databasesKey(spaceId: string): QueryKey {
  return ["databases", spaceId];
}

export function databasePropertiesKey(databaseId: string): QueryKey {
  return ["database-properties", databaseId];
}

export function databaseViewsKey(databaseId: string): QueryKey {
  return ["database-views", databaseId];
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

export function appendRow(qc: QueryClient, databaseId: string, page: IPage) {
  patchRows(qc, databaseId, (rows) => [...rows, { row: page, values: [] }]);
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
