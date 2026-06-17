import { describe, it, expect } from "vitest";
import { isDraftDirty } from "./view-draft";

describe("isDraftDirty", () => {
  it("is not dirty when draft equals saved", () => {
    const saved = { filters: [{ propertyId: "p1", op: "eq", value: "x" }] };
    expect(isDraftDirty({ ...saved }, saved)).toBe(false);
  });

  it("is dirty when a filter changes", () => {
    const saved = { filters: [] };
    const draft = { filters: [{ propertyId: "p1", op: "eq", value: "x" }] };
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
