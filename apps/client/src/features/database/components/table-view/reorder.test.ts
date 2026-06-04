import { describe, it, expect } from "vitest";
import { resolveReorderTarget } from "./reorder";
import { IDatabaseProperty } from "@/features/database/types/database.types.ts";

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

const ordered = [prop("a", "a0"), prop("b", "a1"), prop("c", "a2")];

describe("resolveReorderTarget", () => {
  it("dropping on the right edge places after the target", () => {
    expect(resolveReorderTarget("b", "right", ordered)).toEqual({
      afterPropertyId: "b",
    });
  });

  it("dropping on the left edge places after the previous property", () => {
    expect(resolveReorderTarget("b", "left", ordered)).toEqual({
      afterPropertyId: "a",
    });
  });

  it("dropping on the left edge of the first property moves to the front", () => {
    expect(resolveReorderTarget("a", "left", ordered)).toEqual({
      afterPropertyId: undefined,
    });
  });

  it("dropping on the right edge of the last property keeps it last", () => {
    expect(resolveReorderTarget("c", "right", ordered)).toEqual({
      afterPropertyId: "c",
    });
  });

  it("returns null for an unknown target", () => {
    expect(resolveReorderTarget("zzz", "left", ordered)).toBeNull();
  });

  it("returns null when dropping a source on the left edge of its right neighbour (no-op)", () => {
    // a dropped before b => afterPropertyId would resolve to a (itself).
    expect(resolveReorderTarget("b", "left", ordered, "a")).toBeNull();
  });

  it("returns null when dropping a source on its own right edge (afterPropertyId === self, which the server rejects)", () => {
    expect(resolveReorderTarget("b", "right", ordered, "b")).toBeNull();
  });

  it("still resolves a real move when sourceId differs from the target", () => {
    expect(resolveReorderTarget("b", "right", ordered, "a")).toEqual({
      afterPropertyId: "b",
    });
  });
});
