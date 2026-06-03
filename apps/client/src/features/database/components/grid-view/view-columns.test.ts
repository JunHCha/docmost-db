import { describe, it, expect } from "vitest";
import {
  resolveColumns,
  echoColumns,
  DEFAULT_COLUMN_WIDTH,
} from "./view-columns";
import {
  IDatabaseProperty,
  IViewColumnConfig,
} from "@/features/database/types/database.types.ts";

function prop(id: string, position: string): IDatabaseProperty {
  return {
    id,
    databaseId: "db1",
    name: id,
    type: "text",
    config: {},
    position,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };
}

describe("resolveColumns", () => {
  it("falls back to property.position order when config has no columns", () => {
    const props = [prop("b", "a1"), prop("a", "a0")];
    const result = resolveColumns(props, undefined);
    expect(result.map((c) => c.property.id)).toEqual(["a", "b"]);
  });

  it("orders by config.columns first, position fallback for the rest", () => {
    const props = [prop("a", "a0"), prop("b", "a1"), prop("c", "a2")];
    const config: IViewColumnConfig[] = [
      { propertyId: "c", visible: true },
      { propertyId: "a", visible: true },
    ];
    const result = resolveColumns(props, config);
    // c and a come from config order; b (not in config) trails by position.
    expect(result.map((c) => c.property.id)).toEqual(["c", "a", "b"]);
  });

  it("hides columns whose config entry is visible:false", () => {
    const props = [prop("a", "a0"), prop("b", "a1")];
    const config: IViewColumnConfig[] = [{ propertyId: "a", visible: false }];
    const result = resolveColumns(props, config);
    expect(result.map((c) => c.property.id)).toEqual(["b"]);
  });

  it("applies the configured width and defaults the rest", () => {
    const props = [prop("a", "a0"), prop("b", "a1")];
    const config: IViewColumnConfig[] = [
      { propertyId: "a", visible: true, width: 320 },
    ];
    const result = resolveColumns(props, config);
    const a = result.find((c) => c.property.id === "a")!;
    const b = result.find((c) => c.property.id === "b")!;
    expect(a.width).toBe(320);
    expect(b.width).toBe(DEFAULT_COLUMN_WIDTH);
  });

  it("drops config entries for properties that no longer exist", () => {
    const props = [prop("a", "a0")];
    const config: IViewColumnConfig[] = [
      { propertyId: "gone", visible: true },
      { propertyId: "a", visible: true },
    ];
    const result = resolveColumns(props, config);
    expect(result.map((c) => c.property.id)).toEqual(["a"]);
  });
});

describe("echoColumns", () => {
  it("returns a full entry per property, preserving prior visibility/width", () => {
    const props = [prop("a", "a0"), prop("b", "a1")];
    const prior: IViewColumnConfig[] = [
      { propertyId: "a", visible: false, width: 250 },
    ];
    const result = echoColumns(props, prior);
    expect(result).toEqual([
      { propertyId: "a", visible: false, width: 250 },
      { propertyId: "b", visible: true },
    ]);
  });

  it("applies a patch to a single column and echoes the rest", () => {
    const props = [prop("a", "a0"), prop("b", "a1")];
    const result = echoColumns(props, undefined, {
      propertyId: "b",
      visible: false,
    });
    expect(result).toEqual([
      { propertyId: "a", visible: true },
      { propertyId: "b", visible: false },
    ]);
  });

  it("merges a width patch onto an existing entry without losing visibility", () => {
    const props = [prop("a", "a0")];
    const prior: IViewColumnConfig[] = [{ propertyId: "a", visible: false }];
    const result = echoColumns(props, prior, { propertyId: "a", width: 400 });
    expect(result).toEqual([{ propertyId: "a", visible: false, width: 400 }]);
  });

  it("orders echoed columns by resolved display order", () => {
    const props = [prop("a", "a0"), prop("b", "a1")];
    const prior: IViewColumnConfig[] = [{ propertyId: "b", visible: true }];
    const result = echoColumns(props, prior);
    expect(result.map((c) => c.propertyId)).toEqual(["b", "a"]);
  });
});
