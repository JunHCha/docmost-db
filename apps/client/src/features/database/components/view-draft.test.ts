import { describe, it, expect } from "vitest";
import { isDraftDirty } from "./view-draft";
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
