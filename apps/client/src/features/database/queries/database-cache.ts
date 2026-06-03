import { QueryClient, QueryKey } from "@tanstack/react-query";
import { IPage } from "@/features/page/types/page.types.ts";
import {
  IDatabaseProperty,
  IDatabasePropertyValue,
  IDatabaseRow,
} from "@/features/database/types/database.types.ts";

// Single implicit view per database for now, so the viewId slot is a constant.
export const DEFAULT_VIEW = "default";

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

export function databaseRowsKey(databaseId: string): QueryKey {
  return ["database-rows", databaseId, DEFAULT_VIEW];
}

export function patchRowValue(
  qc: QueryClient,
  databaseId: string,
  value: IDatabasePropertyValue,
) {
  qc.setQueryData<IDatabaseRow[]>(databaseRowsKey(databaseId), (old) => {
    if (!old) return old;
    return old.map((row) => {
      if (row.row.id !== value.pageId) return row;
      const others = row.values.filter(
        (v) => v.propertyId !== value.propertyId,
      );
      return { ...row, values: [...others, value] };
    });
  });
}

export function removeRowValue(
  qc: QueryClient,
  databaseId: string,
  pageId: string,
  propertyId: string,
) {
  qc.setQueryData<IDatabaseRow[]>(databaseRowsKey(databaseId), (old) => {
    if (!old) return old;
    return old.map((row) => {
      if (row.row.id !== pageId) return row;
      return {
        ...row,
        values: row.values.filter((v) => v.propertyId !== propertyId),
      };
    });
  });
}

export function patchRowTitle(
  qc: QueryClient,
  databaseId: string,
  pageId: string,
  title: string,
) {
  qc.setQueryData<IDatabaseRow[]>(databaseRowsKey(databaseId), (old) => {
    if (!old) return old;
    return old.map((row) =>
      row.row.id === pageId
        ? { ...row, row: { ...row.row, title } }
        : row,
    );
  });
}

export function appendRow(qc: QueryClient, databaseId: string, page: IPage) {
  qc.setQueryData<IDatabaseRow[]>(databaseRowsKey(databaseId), (old) => {
    if (!old) return old;
    return [...old, { row: page, values: [] }];
  });
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
