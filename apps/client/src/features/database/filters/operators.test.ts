import { describe, it, expect } from "vitest";
import {
  operatorsForType,
  operatorLabel,
  opNeedsValue,
} from "./operators";

describe("operators", () => {
  it("offers is/contains/empty ops for text and url", () => {
    const ops = operatorsForType("text").map((o) => o.op);
    expect(ops).toEqual([
      "eq",
      "neq",
      "contains",
      "not_contains",
      "is_empty",
      "is_not_empty",
    ]);
    expect(operatorsForType("url").map((o) => o.op)).toEqual(ops);
  });

  it("offers comparison ops for number", () => {
    const ops = operatorsForType("number").map((o) => o.op);
    expect(ops).toContain("gte");
    expect(ops).toContain("lte");
    expect(ops).not.toContain("contains");
  });

  it("offers ordering ops for date", () => {
    const ops = operatorsForType("date").map((o) => o.op);
    expect(ops).toEqual(["eq", "lt", "gt", "lte", "gte", "is_empty", "is_not_empty"]);
  });

  it("offers eq/neq/empty for select", () => {
    expect(operatorsForType("select").map((o) => o.op)).toEqual([
      "eq",
      "neq",
      "is_empty",
      "is_not_empty",
    ]);
  });

  it("offers contains/not_contains/empty for multi_select and relation", () => {
    for (const t of ["multi_select", "relation"] as const) {
      expect(operatorsForType(t).map((o) => o.op)).toEqual([
        "contains",
        "not_contains",
        "is_empty",
        "is_not_empty",
      ]);
    }
  });

  it("offers a single eq op for checkbox", () => {
    expect(operatorsForType("checkbox").map((o) => o.op)).toEqual(["eq"]);
  });

  it("exposes a human label per op", () => {
    expect(operatorLabel("eq")).toBeTruthy();
    expect(operatorLabel("is_empty")).toBeTruthy();
  });

  it("hides the value widget for empty ops only", () => {
    expect(opNeedsValue("is_empty")).toBe(false);
    expect(opNeedsValue("is_not_empty")).toBe(false);
    expect(opNeedsValue("eq")).toBe(true);
    expect(opNeedsValue("contains")).toBe(true);
  });
});
