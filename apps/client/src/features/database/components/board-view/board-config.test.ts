import { describe, it, expect } from "vitest";
import { groupByCandidates, toggleCardProperty } from "./board-config";
import { IDatabaseProperty } from "@/features/database/types/database.types.ts";

function prop(id: string, type: IDatabaseProperty["type"]): IDatabaseProperty {
  return {
    id,
    databaseId: "db1",
    name: id,
    type,
    config: {},
    position: id,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };
}

describe("groupByCandidates", () => {
  it("keeps only select and multi_select properties", () => {
    const props = [
      prop("a", "text"),
      prop("b", "select"),
      prop("c", "multi_select"),
      prop("d", "checkbox"),
    ];
    expect(groupByCandidates(props).map((p) => p.id)).toEqual(["b", "c"]);
  });
});

describe("toggleCardProperty", () => {
  it("adds a property id when absent", () => {
    expect(toggleCardProperty(["a"], "b")).toEqual(["a", "b"]);
  });

  it("removes a property id when present", () => {
    expect(toggleCardProperty(["a", "b"], "a")).toEqual(["b"]);
  });

  it("treats undefined as an empty list", () => {
    expect(toggleCardProperty(undefined, "a")).toEqual(["a"]);
  });
});
