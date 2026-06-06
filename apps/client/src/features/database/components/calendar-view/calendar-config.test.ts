import { describe, it, expect } from "vitest";
import { dateCandidates } from "./calendar-config";
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

describe("dateCandidates", () => {
  it("keeps only date properties", () => {
    const props = [
      prop("a", "text"),
      prop("b", "date"),
      prop("c", "select"),
      prop("d", "date"),
    ];
    expect(dateCandidates(props).map((p) => p.id)).toEqual(["b", "d"]);
  });
});
