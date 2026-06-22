import { describe, expect, it } from "vitest";
import {
  IDatabaseProperty,
  IFilterCondition,
} from "@/features/database/types/database.types.ts";
import { deriveInitialValuesFromFilters } from "./initial-values.ts";

function prop(
  id: string,
  type: IDatabaseProperty["type"],
): IDatabaseProperty {
  return {
    id,
    databaseId: "db1",
    name: id,
    type,
    config: {},
    position: "a0",
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };
}

describe("deriveInitialValuesFromFilters", () => {
  it("returns an empty object for no filters", () => {
    expect(deriveInitialValuesFromFilters([], [])).toEqual({});
  });

  it("fills select eq with the tagged optionId", () => {
    const props = [prop("p1", "select")];
    const filters: IFilterCondition[] = [
      { propertyId: "p1", op: "eq", value: "opt1" },
    ];
    expect(deriveInitialValuesFromFilters(filters, props)).toEqual({
      p1: { type: "select", value: "opt1" },
    });
  });

  it("fills checkbox eq with the boolean", () => {
    const props = [prop("p1", "checkbox")];
    const filters: IFilterCondition[] = [
      { propertyId: "p1", op: "eq", value: true },
    ];
    expect(deriveInitialValuesFromFilters(filters, props)).toEqual({
      p1: { type: "checkbox", value: true },
    });
  });

  it("fills multi_select contains as a one-element array", () => {
    const props = [prop("p1", "multi_select")];
    const filters: IFilterCondition[] = [
      { propertyId: "p1", op: "contains", value: "opt1" },
    ];
    expect(deriveInitialValuesFromFilters(filters, props)).toEqual({
      p1: { type: "multi_select", value: ["opt1"] },
    });
  });

  it("fills relation contains as a one-element array", () => {
    const props = [prop("p1", "relation")];
    const filters: IFilterCondition[] = [
      { propertyId: "p1", op: "contains", value: "page1" },
    ];
    expect(deriveInitialValuesFromFilters(filters, props)).toEqual({
      p1: { type: "relation", value: ["page1"] },
    });
  });

  it("ignores excluded ops and types", () => {
    const props = [
      prop("p1", "text"),
      prop("p2", "number"),
      prop("p3", "select"),
    ];
    const filters: IFilterCondition[] = [
      { propertyId: "p1", op: "eq", value: "hi" },
      { propertyId: "p2", op: "gt", value: 5 },
      { propertyId: "p3", op: "neq", value: "opt1" },
    ];
    expect(deriveInitialValuesFromFilters(filters, props)).toEqual({});
  });

  it("ignores filters with null/undefined value", () => {
    const props = [prop("p1", "select")];
    const filters: IFilterCondition[] = [{ propertyId: "p1", op: "eq" }];
    expect(deriveInitialValuesFromFilters(filters, props)).toEqual({});
  });

  it("skips select eq when two different values conflict", () => {
    const props = [prop("p1", "select")];
    const filters: IFilterCondition[] = [
      { propertyId: "p1", op: "eq", value: "opt1" },
      { propertyId: "p1", op: "eq", value: "opt2" },
    ];
    expect(deriveInitialValuesFromFilters(filters, props)).toEqual({});
  });

  it("keeps select eq when duplicate values agree", () => {
    const props = [prop("p1", "select")];
    const filters: IFilterCondition[] = [
      { propertyId: "p1", op: "eq", value: "opt1" },
      { propertyId: "p1", op: "eq", value: "opt1" },
    ];
    expect(deriveInitialValuesFromFilters(filters, props)).toEqual({
      p1: { type: "select", value: "opt1" },
    });
  });

  it("skips checkbox eq when values conflict", () => {
    const props = [prop("p1", "checkbox")];
    const filters: IFilterCondition[] = [
      { propertyId: "p1", op: "eq", value: true },
      { propertyId: "p1", op: "eq", value: false },
    ];
    expect(deriveInitialValuesFromFilters(filters, props)).toEqual({});
  });

  it("unions multi_select contains values", () => {
    const props = [prop("p1", "multi_select")];
    const filters: IFilterCondition[] = [
      { propertyId: "p1", op: "contains", value: "opt1" },
      { propertyId: "p1", op: "contains", value: "opt2" },
      { propertyId: "p1", op: "contains", value: "opt1" },
    ];
    expect(deriveInitialValuesFromFilters(filters, props)).toEqual({
      p1: { type: "multi_select", value: ["opt1", "opt2"] },
    });
  });

  it("unions relation contains values", () => {
    const props = [prop("p1", "relation")];
    const filters: IFilterCondition[] = [
      { propertyId: "p1", op: "contains", value: "page1" },
      { propertyId: "p1", op: "contains", value: "page2" },
    ];
    expect(deriveInitialValuesFromFilters(filters, props)).toEqual({
      p1: { type: "relation", value: ["page1", "page2"] },
    });
  });

  it("ignores filters referencing an unknown property", () => {
    const filters: IFilterCondition[] = [
      { propertyId: "ghost", op: "eq", value: "opt1" },
    ];
    expect(deriveInitialValuesFromFilters(filters, [])).toEqual({});
  });
});
