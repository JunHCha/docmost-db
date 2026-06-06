import { describe, it, expect } from "vitest";
import { groupByCandidates } from "./board-config";
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
