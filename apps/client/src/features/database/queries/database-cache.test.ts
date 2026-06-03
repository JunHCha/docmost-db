import { describe, it, expect, beforeEach } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import {
  databaseInfoKey,
  databaseRowsKey,
  databasePropertiesKey,
  databaseViewsKey,
  patchRowValue,
  removeRowValue,
  appendRow,
  appendProperty,
  patchProperty,
  removeProperty,
  patchRowTitle,
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
    qc.setQueryData(databaseRowsKey(dbId, "v1"), [makeRow("p1"), makeRow("p2")]);
    const value = makeValue("p1", "prop1", "hello");

    patchRowValue(qc, dbId, value);

    const rows = qc.getQueryData<IDatabaseRow[]>(databaseRowsKey(dbId, "v1"));
    expect(rows![0].values).toEqual([value]);
    expect(rows![1].values).toEqual([]);
  });

  it("patchRowValue replaces an existing value for the same property", () => {
    const old = makeValue("p1", "prop1", "old");
    qc.setQueryData(databaseRowsKey(dbId, "v1"), [
      { row: { id: "p1" } as any, values: [old] },
    ]);
    const next = makeValue("p1", "prop1", "new");

    patchRowValue(qc, dbId, next);

    const rows = qc.getQueryData<IDatabaseRow[]>(databaseRowsKey(dbId, "v1"));
    expect(rows![0].values).toHaveLength(1);
    expect(rows![0].values[0].value.value).toBe("new");
  });

  it("removeRowValue removes the matching (pageId, propertyId) value", () => {
    const a = makeValue("p1", "prop1", "a");
    const b = makeValue("p1", "prop2", "b");
    qc.setQueryData(databaseRowsKey(dbId, "v1"), [
      { row: { id: "p1" } as any, values: [a, b] },
    ]);

    removeRowValue(qc, dbId, "p1", "prop1");

    const rows = qc.getQueryData<IDatabaseRow[]>(databaseRowsKey(dbId, "v1"));
    expect(rows![0].values).toEqual([b]);
  });

  it("appendRow appends a new row with empty values", () => {
    qc.setQueryData(databaseRowsKey(dbId, "v1"), [makeRow("p1")]);

    appendRow(qc, dbId, { id: "p2" } as any);

    const rows = qc.getQueryData<IDatabaseRow[]>(databaseRowsKey(dbId, "v1"));
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

  it("patchRowTitle updates the matching row's title", () => {
    qc.setQueryData(databaseRowsKey(dbId, "v1"), [
      { row: { id: "p1", title: "Old" } as any, values: [] },
      makeRow("p2"),
    ]);

    patchRowTitle(qc, dbId, "p1", "New");

    const rows = qc.getQueryData<IDatabaseRow[]>(databaseRowsKey(dbId, "v1"));
    expect(rows![0].row.title).toBe("New");
    expect(rows![1].row.id).toBe("p2");
  });

  it("patchRowTitle is a no-op when the cache is empty", () => {
    expect(() => patchRowTitle(qc, dbId, "p1", "New")).not.toThrow();
    expect(qc.getQueryData(databaseRowsKey(dbId, "v1"))).toBeUndefined();
  });

  it("databaseRowsKey is namespaced by databaseId and viewId", () => {
    expect(databaseRowsKey(dbId, "v1")).toEqual(["database-rows", dbId, "v1"]);
    expect(databaseRowsKey(dbId, "v1")).not.toEqual(
      databaseRowsKey(dbId, "v2"),
    );
  });

  it("databaseViewsKey is namespaced by databaseId", () => {
    expect(databaseViewsKey(dbId)).toEqual(["database-views", dbId]);
  });

  it("patchRowValue patches every cached view for the database", () => {
    const value = makeValue("p1", "prop1", "x");
    qc.setQueryData(databaseRowsKey(dbId, "v1"), [makeRow("p1")]);
    qc.setQueryData(databaseRowsKey(dbId, "v2"), [makeRow("p1")]);

    patchRowValue(qc, dbId, value);

    expect(
      qc.getQueryData<IDatabaseRow[]>(databaseRowsKey(dbId, "v1"))![0].values,
    ).toEqual([value]);
    expect(
      qc.getQueryData<IDatabaseRow[]>(databaseRowsKey(dbId, "v2"))![0].values,
    ).toEqual([value]);
  });

  it("databaseInfoKey is namespaced by pageId, distinct from the databaseId slot", () => {
    expect(databaseInfoKey("page1")).toEqual(["database-info", "page1"]);
    // Must not collide with the databaseId-keyed convention (§6).
    expect(databaseInfoKey("page1")).not.toEqual(["database", "page1"]);
  });

  it("cache helpers are no-ops when the cache is empty", () => {
    expect(() =>
      patchRowValue(qc, dbId, makeValue("p1", "prop1", "x")),
    ).not.toThrow();
    expect(qc.getQueryData(databaseRowsKey(dbId, "v1"))).toBeUndefined();
  });
});
