import { describe, it, expect } from "vitest";
import {
  IFilterCondition,
  ISortCondition,
} from "@/features/database/types/database.types.ts";
import { sanitizeFilters, sanitizeSorts } from "./sanitize";

describe("sanitizeFilters", () => {
  it("drops a needs-value condition whose value is missing", () => {
    const filters: IFilterCondition[] = [
      { propertyId: "p1", op: "eq", value: undefined },
    ];
    expect(sanitizeFilters(filters)).toEqual([]);
  });

  it("drops a needs-value condition whose value is null", () => {
    const filters: IFilterCondition[] = [
      { propertyId: "p1", op: "contains", value: null },
    ];
    expect(sanitizeFilters(filters)).toEqual([]);
  });

  it("keeps a needs-value condition with a value", () => {
    const filters: IFilterCondition[] = [
      { propertyId: "p1", op: "eq", value: "o1" },
    ];
    expect(sanitizeFilters(filters)).toEqual(filters);
  });

  it("keeps empty-ops even without a value", () => {
    const filters: IFilterCondition[] = [
      { propertyId: "p1", op: "is_empty" },
      { propertyId: "p2", op: "is_not_empty" },
    ];
    expect(sanitizeFilters(filters)).toEqual(filters);
  });

  it("keeps a falsy-but-present value such as empty string or 0", () => {
    const filters: IFilterCondition[] = [
      { propertyId: "p1", op: "eq", value: "" },
      { propertyId: "p2", op: "eq", value: 0 },
      { propertyId: "p3", op: "eq", value: false },
    ];
    expect(sanitizeFilters(filters)).toEqual(filters);
  });

  it("filters a mixed list, preserving order", () => {
    const filters: IFilterCondition[] = [
      { propertyId: "p1", op: "eq", value: "o1" },
      { propertyId: "p2", op: "contains", value: undefined },
      { propertyId: "p3", op: "is_empty" },
    ];
    expect(sanitizeFilters(filters)).toEqual([
      { propertyId: "p1", op: "eq", value: "o1" },
      { propertyId: "p3", op: "is_empty" },
    ]);
  });
});

describe("sanitizeSorts", () => {
  it("returns sorts unchanged (sorts always have a property and direction)", () => {
    const sorts: ISortCondition[] = [
      { propertyId: "p1", direction: "asc" },
      { propertyId: "p2", direction: "desc" },
    ];
    expect(sanitizeSorts(sorts)).toEqual(sorts);
  });

  it("drops a sort with no propertyId", () => {
    const sorts: ISortCondition[] = [
      { propertyId: "", direction: "asc" },
      { propertyId: "p2", direction: "desc" },
    ];
    expect(sanitizeSorts(sorts)).toEqual([{ propertyId: "p2", direction: "desc" }]);
  });
});
