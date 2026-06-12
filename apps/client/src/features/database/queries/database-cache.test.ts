import { describe, it, expect, beforeEach } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import {
  databaseInfoByIdKey,
  databaseInfoKey,
  databaseRowsKey,
  databasePropertiesKey,
  databaseViewsKey,
  patchRowValue,
  patchRowValueIfNewer,
  removeRowValue,
  removeRows,
  appendRow,
  appendRowIfAbsent,
  appendProperty,
  patchProperty,
  removeProperty,
  patchRowTitle,
  patchView,
  patchRowTitleEverywhere,
} from "./database-cache";
import {
  IDatabaseProperty,
  IDatabasePropertyValue,
  IDatabaseRow,
  IDatabaseView,
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

  it("patchRowValueIfNewer upserts when the cell is absent", () => {
    qc.setQueryData(databaseRowsKey(dbId, "v1"), [makeRow("p1")]);
    const value = makeValue("p1", "prop1", "remote");

    patchRowValueIfNewer(qc, dbId, value);

    const rows = qc.getQueryData<IDatabaseRow[]>(databaseRowsKey(dbId, "v1"));
    expect(rows![0].values).toEqual([value]);
  });

  it("patchRowValueIfNewer replaces when the incoming value is newer", () => {
    const old = { ...makeValue("p1", "prop1", "old"), updatedAt: new Date(1000) };
    qc.setQueryData(databaseRowsKey(dbId, "v1"), [
      { row: { id: "p1" } as any, values: [old] },
    ]);
    const next = { ...makeValue("p1", "prop1", "new"), updatedAt: new Date(2000) };

    patchRowValueIfNewer(qc, dbId, next);

    const rows = qc.getQueryData<IDatabaseRow[]>(databaseRowsKey(dbId, "v1"));
    expect(rows![0].values[0].value.value).toBe("new");
  });

  it("patchRowValueIfNewer ignores a stale value (LWW convergence)", () => {
    const current = {
      ...makeValue("p1", "prop1", "current"),
      updatedAt: new Date(2000),
    };
    qc.setQueryData(databaseRowsKey(dbId, "v1"), [
      { row: { id: "p1" } as any, values: [current] },
    ]);
    const stale = {
      ...makeValue("p1", "prop1", "stale"),
      updatedAt: new Date(1000),
    };

    patchRowValueIfNewer(qc, dbId, stale);

    const rows = qc.getQueryData<IDatabaseRow[]>(databaseRowsKey(dbId, "v1"));
    expect(rows![0].values[0].value.value).toBe("current");
  });

  it("removeRows drops the selected rows across every cached view", () => {
    qc.setQueryData(databaseRowsKey(dbId, "v1"), [
      makeRow("p1"),
      makeRow("p2"),
      makeRow("p3"),
    ]);
    // A second view where p2 is filtered out — removeRows must not choke on it.
    qc.setQueryData(databaseRowsKey(dbId, "v2"), [makeRow("p1"), makeRow("p3")]);

    removeRows(qc, dbId, ["p1", "p3"]);

    expect(
      qc.getQueryData<IDatabaseRow[]>(databaseRowsKey(dbId, "v1")),
    ).toEqual([makeRow("p2")]);
    expect(
      qc.getQueryData<IDatabaseRow[]>(databaseRowsKey(dbId, "v2")),
    ).toEqual([]);
  });

  it("appendRow appends a new row with empty values", () => {
    qc.setQueryData(databaseRowsKey(dbId, "v1"), [makeRow("p1")]);

    appendRow(qc, dbId, { id: "p2" } as any);

    const rows = qc.getQueryData<IDatabaseRow[]>(databaseRowsKey(dbId, "v1"));
    expect(rows).toHaveLength(2);
    expect(rows![1]).toEqual({ row: { id: "p2" }, values: [] });
  });

  it("appendRowIfAbsent appends a row that is not yet present", () => {
    qc.setQueryData(databaseRowsKey(dbId, "v1"), [makeRow("p1")]);

    appendRowIfAbsent(qc, dbId, { id: "p2" } as any);

    const rows = qc.getQueryData<IDatabaseRow[]>(databaseRowsKey(dbId, "v1"));
    expect(rows!.map((r) => r.row.id)).toEqual(["p1", "p2"]);
  });

  it("appendRowIfAbsent is idempotent when the row already exists", () => {
    qc.setQueryData(databaseRowsKey(dbId, "v1"), [makeRow("p1"), makeRow("p2")]);

    appendRowIfAbsent(qc, dbId, { id: "p2" } as any);

    const rows = qc.getQueryData<IDatabaseRow[]>(databaseRowsKey(dbId, "v1"));
    expect(rows!.map((r) => r.row.id)).toEqual(["p1", "p2"]);
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
    expect(databaseRowsKey(dbId, "v1")).toEqual([
      "database-rows",
      dbId,
      "v1",
      { filters: [], sorts: [] },
    ]);
    expect(databaseRowsKey(dbId, "v1")).not.toEqual(
      databaseRowsKey(dbId, "v2"),
    );
  });

  it("databaseRowsKey trails the filters/sorts config so a filter change is a distinct slot", () => {
    const a = databaseRowsKey(dbId, "v1", {
      filters: [{ propertyId: "p1", op: "eq", value: "x" }],
    });
    const b = databaseRowsKey(dbId, "v1", {
      filters: [{ propertyId: "p1", op: "eq", value: "y" }],
    });
    // Same view, different filter value => different cache slot.
    expect(a).not.toEqual(b);
    // ...but both still share the ["database-rows", dbId] prefix that the
    // optimistic patchers / invalidators rely on.
    expect(a.slice(0, 2)).toEqual(["database-rows", dbId]);
    expect(b.slice(0, 2)).toEqual(["database-rows", dbId]);
  });

  it("prefix patchers still reach a slot keyed with a non-empty config (removeRows contract)", () => {
    const key = databaseRowsKey(dbId, "v1", {
      filters: [{ propertyId: "p1", op: "eq", value: "x" }],
    });
    qc.setQueryData(key, [makeRow("p1"), makeRow("p2")]);

    // removeRows targets the ["database-rows", dbId] prefix; the config segment
    // must not hide the slot from the bulk-delete patch (other views depend on
    // this prefix contract).
    removeRows(qc, dbId, ["p1"]);

    expect(qc.getQueryData<IDatabaseRow[]>(key)).toEqual([makeRow("p2")]);
  });

  it("databaseViewsKey is namespaced by databaseId with a null embed slot by default", () => {
    expect(databaseViewsKey(dbId)).toEqual(["database-views", dbId, null]);
  });

  it("databaseViewsKey includes the embedId in its own scope slot", () => {
    expect(databaseViewsKey(dbId, "embed-1")).toEqual([
      "database-views",
      dbId,
      "embed-1",
    ]);
    // The original scope (no embed) and an embed scope are distinct cache slots.
    expect(databaseViewsKey(dbId)).not.toEqual(databaseViewsKey(dbId, "embed-1"));
  });

  it("patchView replaces the matching view without touching the array identity of others", () => {
    const v1 = { id: "v1", config: {}, name: "Grid" } as unknown as IDatabaseView;
    const v2 = { id: "v2", config: {}, name: "Board" } as unknown as IDatabaseView;
    qc.setQueryData(databaseViewsKey(dbId), [v1, v2]);

    const updated = {
      ...v1,
      config: { filters: [{ propertyId: "p1", op: "eq", value: "x" }] },
    } as unknown as IDatabaseView;
    patchView(qc, dbId, undefined, updated);

    const views = qc.getQueryData<IDatabaseView[]>(databaseViewsKey(dbId))!;
    expect(views[0]).toEqual(updated);
    // The untouched view is unchanged.
    expect(views[1]).toEqual(v2);
    // Only the matching view's config was swapped in.
    expect(views[0].config).toEqual(updated.config);
    expect(views[1].config).toEqual({});
  });

  it("patchView targets only the given embed scope's cache slot", () => {
    const original = { id: "v1", config: {}, name: "Orig" } as unknown as IDatabaseView;
    const embedView = { id: "v9", config: {}, name: "Embed" } as unknown as IDatabaseView;
    qc.setQueryData(databaseViewsKey(dbId), [original]);
    qc.setQueryData(databaseViewsKey(dbId, "embed-1"), [embedView]);

    const updated = { ...embedView, name: "EmbedRenamed" } as unknown as IDatabaseView;
    patchView(qc, dbId, "embed-1", updated);

    // Only the embed scope slot is patched; the original scope is untouched.
    expect(
      qc.getQueryData<IDatabaseView[]>(databaseViewsKey(dbId, "embed-1"))![0].name,
    ).toBe("EmbedRenamed");
    expect(
      qc.getQueryData<IDatabaseView[]>(databaseViewsKey(dbId))![0].name,
    ).toBe("Orig");
  });

  it("patchView is a no-op when the views cache is empty", () => {
    expect(() =>
      patchView(qc, dbId, undefined, { id: "v1" } as unknown as IDatabaseView),
    ).not.toThrow();
    expect(qc.getQueryData(databaseViewsKey(dbId))).toBeUndefined();
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

  it("databaseInfoByIdKey is namespaced by databaseId, distinct from the pageId info slot", () => {
    expect(databaseInfoByIdKey("db1")).toEqual(["database-info-by-id", "db1"]);
    // The embed resolves by databaseId, so it must not collide with the
    // pageId-keyed info slot (§6).
    expect(databaseInfoByIdKey("db1")).not.toEqual(databaseInfoKey("db1"));
  });

  it("cache helpers are no-ops when the cache is empty", () => {
    expect(() =>
      patchRowValue(qc, dbId, makeValue("p1", "prop1", "x")),
    ).not.toThrow();
    expect(qc.getQueryData(databaseRowsKey(dbId, "v1"))).toBeUndefined();
  });

  describe("patchRowTitleEverywhere", () => {
    it("updates the matching row title in every database-rows slot", () => {
      // Two different databases with different viewIds — patchRowTitleEverywhere
      // must update the row in ALL ["database-rows"] slots regardless of databaseId.
      qc.setQueryData(databaseRowsKey("db1", "v1"), [
        { row: { id: "p1", title: "Old" } as any, values: [] },
        makeRow("p2"),
      ]);
      qc.setQueryData(databaseRowsKey("db2", "v1"), [
        { row: { id: "p1", title: "Old" } as any, values: [] },
        makeRow("p3"),
      ]);

      patchRowTitleEverywhere(qc, "p1", "New");

      const slot1 = qc.getQueryData<IDatabaseRow[]>(databaseRowsKey("db1", "v1"))!;
      const slot2 = qc.getQueryData<IDatabaseRow[]>(databaseRowsKey("db2", "v1"))!;

      expect(slot1[0].row.title).toBe("New");
      expect(slot2[0].row.title).toBe("New");
    });

    it("leaves other rows unchanged", () => {
      qc.setQueryData(databaseRowsKey(dbId, "v1"), [
        { row: { id: "p1", title: "Old" } as any, values: [] },
        { row: { id: "p2", title: "Keep" } as any, values: [] },
      ]);

      patchRowTitleEverywhere(qc, "p1", "Updated");

      const rows = qc.getQueryData<IDatabaseRow[]>(databaseRowsKey(dbId, "v1"))!;
      expect(rows[0].row.title).toBe("Updated");
      expect(rows[1].row.title).toBe("Keep");
    });

    it("is a no-op when the cache is empty", () => {
      expect(() => patchRowTitleEverywhere(qc, "p1", "New")).not.toThrow();
    });

    it("patches multiple views of the same database", () => {
      qc.setQueryData(databaseRowsKey(dbId, "v1"), [
        { row: { id: "p1", title: "Old" } as any, values: [] },
      ]);
      qc.setQueryData(databaseRowsKey(dbId, "v2"), [
        { row: { id: "p1", title: "Old" } as any, values: [] },
      ]);

      patchRowTitleEverywhere(qc, "p1", "Fresh");

      const v1 = qc.getQueryData<IDatabaseRow[]>(databaseRowsKey(dbId, "v1"))!;
      const v2 = qc.getQueryData<IDatabaseRow[]>(databaseRowsKey(dbId, "v2"))!;
      expect(v1[0].row.title).toBe("Fresh");
      expect(v2[0].row.title).toBe("Fresh");
    });
  });
});
