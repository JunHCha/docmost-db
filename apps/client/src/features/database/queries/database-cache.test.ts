import { describe, it, expect, beforeEach } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import {
  databaseRowsKey,
  databasePropertiesKey,
  patchRowValue,
  removeRowValue,
  appendRow,
  appendProperty,
  patchProperty,
  removeProperty,
} from "./database-cache";
import {
  IDatabaseProperty,
  IDatabasePropertyValue,
  IDatabaseRow,
} from "@/features/database/types/database.types.ts";

const dbId = "db1";

function makeRow(pageId: string): IDatabaseRow {
  return { row: { id: pageId } as any, values: [] };
}

function makeValue(
  pageId: string,
  propertyId: string,
  v: any,
): IDatabasePropertyValue {
  return {
    id: `${pageId}-${propertyId}`,
    pageId,
    propertyId,
    value: { type: "text", value: v },
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function makeProperty(id: string, position: string): IDatabaseProperty {
  return {
    id,
    databaseId: dbId,
    name: id,
    type: "text",
    config: {},
    position,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };
}

describe("database-cache", () => {
  let qc: QueryClient;

  beforeEach(() => {
    qc = new QueryClient();
  });

  it("patchRowValue upserts a value into the matching row", () => {
    qc.setQueryData(databaseRowsKey(dbId), [makeRow("p1"), makeRow("p2")]);
    const value = makeValue("p1", "prop1", "hello");

    patchRowValue(qc, dbId, value);

    const rows = qc.getQueryData<IDatabaseRow[]>(databaseRowsKey(dbId));
    expect(rows![0].values).toEqual([value]);
    expect(rows![1].values).toEqual([]);
  });

  it("patchRowValue replaces an existing value for the same property", () => {
    const old = makeValue("p1", "prop1", "old");
    qc.setQueryData(databaseRowsKey(dbId), [
      { row: { id: "p1" } as any, values: [old] },
    ]);
    const next = makeValue("p1", "prop1", "new");

    patchRowValue(qc, dbId, next);

    const rows = qc.getQueryData<IDatabaseRow[]>(databaseRowsKey(dbId));
    expect(rows![0].values).toHaveLength(1);
    expect(rows![0].values[0].value.value).toBe("new");
  });

  it("removeRowValue removes the matching (pageId, propertyId) value", () => {
    const a = makeValue("p1", "prop1", "a");
    const b = makeValue("p1", "prop2", "b");
    qc.setQueryData(databaseRowsKey(dbId), [
      { row: { id: "p1" } as any, values: [a, b] },
    ]);

    removeRowValue(qc, dbId, "p1", "prop1");

    const rows = qc.getQueryData<IDatabaseRow[]>(databaseRowsKey(dbId));
    expect(rows![0].values).toEqual([b]);
  });

  it("appendRow appends a new row with empty values", () => {
    qc.setQueryData(databaseRowsKey(dbId), [makeRow("p1")]);

    appendRow(qc, dbId, { id: "p2" } as any);

    const rows = qc.getQueryData<IDatabaseRow[]>(databaseRowsKey(dbId));
    expect(rows).toHaveLength(2);
    expect(rows![1]).toEqual({ row: { id: "p2" }, values: [] });
  });

  it("appendProperty appends to the properties cache", () => {
    qc.setQueryData(databasePropertiesKey(dbId), [makeProperty("prop1", "a0")]);

    appendProperty(qc, dbId, makeProperty("prop2", "a1"));

    const props = qc.getQueryData<IDatabaseProperty[]>(
      databasePropertiesKey(dbId),
    );
    expect(props).toHaveLength(2);
    expect(props![1].id).toBe("prop2");
  });

  it("patchProperty replaces the matching property", () => {
    qc.setQueryData(databasePropertiesKey(dbId), [
      makeProperty("prop1", "a0"),
      makeProperty("prop2", "a1"),
    ]);
    const updated = { ...makeProperty("prop1", "a0"), name: "Renamed" };

    patchProperty(qc, dbId, updated);

    const props = qc.getQueryData<IDatabaseProperty[]>(
      databasePropertiesKey(dbId),
    );
    expect(props![0].name).toBe("Renamed");
    expect(props![1].id).toBe("prop2");
  });

  it("removeProperty removes the matching property", () => {
    qc.setQueryData(databasePropertiesKey(dbId), [
      makeProperty("prop1", "a0"),
      makeProperty("prop2", "a1"),
    ]);

    removeProperty(qc, dbId, "prop1");

    const props = qc.getQueryData<IDatabaseProperty[]>(
      databasePropertiesKey(dbId),
    );
    expect(props).toHaveLength(1);
    expect(props![0].id).toBe("prop2");
  });

  it("cache helpers are no-ops when the cache is empty", () => {
    expect(() =>
      patchRowValue(qc, dbId, makeValue("p1", "prop1", "x")),
    ).not.toThrow();
    expect(qc.getQueryData(databaseRowsKey(dbId))).toBeUndefined();
  });
});
