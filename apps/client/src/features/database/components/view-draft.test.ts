import { describe, it, expect } from "vitest";
import { isDraftDirty, pruneUnknownPropertyRefs } from "./view-draft";
import { resolveColumns } from "./table-view/view-columns";
import { IDatabaseProperty } from "@/features/database/types/database.types.ts";

describe("isDraftDirty", () => {
  it("is not dirty when draft equals saved", () => {
    const saved = {
      filters: [{ propertyId: "p1", op: "eq" as const, value: "x" }],
    };
    expect(isDraftDirty({ ...saved }, saved)).toBe(false);
  });

  it("is dirty when a filter changes", () => {
    const saved = { filters: [] };
    const draft = {
      filters: [{ propertyId: "p1", op: "eq" as const, value: "x" }],
    };
    expect(isDraftDirty(draft, saved)).toBe(true);
  });

  it("is dirty when sorts reorder", () => {
    const saved = {
      sorts: [
        { propertyId: "p1", direction: "asc" as const },
        { propertyId: "p2", direction: "asc" as const },
      ],
    };
    const draft = {
      sorts: [
        { propertyId: "p2", direction: "asc" as const },
        { propertyId: "p1", direction: "asc" as const },
      ],
    };
    expect(isDraftDirty(draft, saved)).toBe(true);
  });

  it("is dirty when column order changes", () => {
    const saved = {
      columns: [
        { propertyId: "a", visible: true },
        { propertyId: "b", visible: true },
      ],
    };
    const draft = {
      columns: [
        { propertyId: "b", visible: true },
        { propertyId: "a", visible: true },
      ],
    };
    expect(isDraftDirty(draft, saved)).toBe(true);
  });

  it("is dirty when a column visibility or width changes", () => {
    const saved = { columns: [{ propertyId: "a", visible: true }] };
    expect(
      isDraftDirty(
        { columns: [{ propertyId: "a", visible: false }] },
        saved,
      ),
    ).toBe(true);
    expect(
      isDraftDirty(
        { columns: [{ propertyId: "a", visible: true, width: 240 }] },
        saved,
      ),
    ).toBe(true);
  });

  it("is dirty when groupBy / dateProperty / titleWidth change", () => {
    expect(isDraftDirty({ groupByPropertyId: "g" }, {})).toBe(true);
    expect(isDraftDirty({ datePropertyId: "d" }, {})).toBe(true);
    expect(isDraftDirty({ titleWidth: 300 }, {})).toBe(true);
  });

  it("ignores non-editable keys", () => {
    expect(
      isDraftDirty({ cardProperties: ["x"] }, { cardProperties: [] }),
    ).toBe(false);
  });

  it("treats absent and undefined fields as equal", () => {
    expect(isDraftDirty({}, { groupByPropertyId: undefined })).toBe(false);
  });

  it("is never dirty without both draft and saved", () => {
    expect(isDraftDirty(undefined, {})).toBe(false);
    expect(isDraftDirty({}, undefined)).toBe(false);
  });

  // Postgres jsonb round-trips can reorder object keys; meaning-equal configs
  // must never look dirty after a refresh (false "Save changes" bug).
  it("ignores nested object key order in columns and filters", () => {
    const saved = {
      columns: [{ propertyId: "a", visible: true, width: 240 }],
      filters: [{ propertyId: "p1", op: "eq" as const, value: "x" }],
    };
    const draft = {
      columns: [{ width: 240, visible: true, propertyId: "a" }],
      filters: [{ value: "x", op: "eq" as const, propertyId: "p1" }],
    };
    expect(isDraftDirty(draft, saved)).toBe(false);
  });

  it("treats null, undefined and absent top-level fields as equal", () => {
    expect(isDraftDirty({ groupByPropertyId: null as any }, {})).toBe(false);
    expect(
      isDraftDirty({}, { groupByPropertyId: null as any }),
    ).toBe(false);
    expect(
      isDraftDirty(
        { datePropertyId: undefined },
        { datePropertyId: null as any },
      ),
    ).toBe(false);
  });

  it("treats an empty array as equal to an absent field", () => {
    expect(isDraftDirty({ filters: [] }, {})).toBe(false);
    expect(isDraftDirty({}, { sorts: [] })).toBe(false);
  });

  it("strips null/undefined nested keys before comparing", () => {
    const saved = { filters: [{ propertyId: "p1", op: "eq" as const }] };
    const draft = {
      filters: [{ propertyId: "p1", op: "eq" as const, value: undefined }],
    };
    expect(isDraftDirty(draft, saved)).toBe(false);
  });

  it("still detects real value differences after canonicalisation", () => {
    expect(
      isDraftDirty(
        { columns: [{ propertyId: "a", visible: true, width: 240 }] },
        { columns: [{ propertyId: "a", visible: true, width: 200 }] },
      ),
    ).toBe(true);
    expect(
      isDraftDirty(
        { filters: [{ propertyId: "p1", op: "eq" as const, value: "x" }] },
        {},
      ),
    ).toBe(true);
  });
});

describe("auto-created reverse relation column does not dirty sibling views (#111)", () => {
  // The backend creates the reverse relation column WITHOUT touching any view
  // config (Phase B/D). So a sibling view whose saved+draft configs both predate
  // the new column must stay clean: isDraftDirty compares only the configs (which
  // are identical), while resolveColumns surfaces the new property as visible by
  // default. This pins both halves against a regression where the auto-create
  // leaks into a dirty draft / hidden column.
  const prop = (id: string, position: string): IDatabaseProperty => ({
    id,
    databaseId: "db1",
    name: id,
    type: "text",
    config: {},
    position,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  });

  it("stays clean and auto-shows the new column", () => {
    // saved + draft were captured before the reverse column existed, so both
    // reference only the original columns and are byte-identical.
    const savedColumns = [
      { propertyId: "a", visible: true },
      { propertyId: "b", visible: true },
    ];
    const saved = { columns: savedColumns };
    const draft = { columns: savedColumns.map((c) => ({ ...c })) };

    // A reverse relation column "rev" appears in properties but in neither config.
    const properties = [
      prop("a", "a0"),
      prop("b", "a1"),
      prop("rev", "a2"),
    ];

    // No new dirty state: the auto-create never edited the view config.
    expect(isDraftDirty(draft, saved)).toBe(false);

    // The new column is rendered (visible) by default despite being absent from
    // the config, trailing the configured columns by position.
    const resolved = resolveColumns(properties, savedColumns);
    expect(resolved.map((c) => c.property.id)).toEqual(["a", "b", "rev"]);
  });
});

describe("pruneUnknownPropertyRefs", () => {
  const known = new Set(["p1", "p2"]);

  it("returns the config untouched when every ref is known", () => {
    const config = {
      columns: [{ propertyId: "p1", visible: true }],
      filters: [{ propertyId: "p2", op: "eq" as const, value: "x" }],
      sorts: [{ propertyId: "p1", direction: "asc" as const }],
      groupByPropertyId: "p2",
      datePropertyId: "p1",
      titleWidth: 300,
    };
    const { config: pruned, dropped } = pruneUnknownPropertyRefs(config, known);
    expect(dropped).toBe(false);
    expect(pruned).toEqual(config);
  });

  it("drops filter/sort/column entries pointing at a deleted property", () => {
    const { config: pruned, dropped } = pruneUnknownPropertyRefs(
      {
        columns: [
          { propertyId: "p1", visible: true },
          { propertyId: "gone", visible: false },
        ],
        filters: [{ propertyId: "gone", op: "eq" as const, value: "x" }],
        sorts: [
          { propertyId: "gone", direction: "asc" as const },
          { propertyId: "p2", direction: "desc" as const },
        ],
      },
      known,
    );
    expect(dropped).toBe(true);
    expect(pruned.columns).toEqual([{ propertyId: "p1", visible: true }]);
    expect(pruned.filters).toEqual([]);
    expect(pruned.sorts).toEqual([{ propertyId: "p2", direction: "desc" as const }]);
  });

  it("unsets groupBy/dateProperty refs to a deleted property", () => {
    const { config: pruned, dropped } = pruneUnknownPropertyRefs(
      { groupByPropertyId: "gone", datePropertyId: "gone" },
      known,
    );
    expect(dropped).toBe(true);
    expect(pruned.groupByPropertyId).toBeUndefined();
    expect(pruned.datePropertyId).toBeUndefined();
  });

  it("keeps the Title sentinel and in-progress rows without a property", () => {
    const config = {
      filters: [
        { propertyId: "__title__", op: "contains" as const, value: "plan" },
        { propertyId: "", op: "eq" as const },
      ],
      sorts: [{ propertyId: "__title__", direction: "asc" as const }],
    };
    const { config: pruned, dropped } = pruneUnknownPropertyRefs(config, known);
    expect(dropped).toBe(false);
    expect(pruned).toEqual(config);
  });
});
