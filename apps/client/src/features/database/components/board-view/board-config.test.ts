import { describe, it, expect } from "vitest";
import { groupByCandidates, initialBoardConfig } from "./board-config";
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

describe("initialBoardConfig", () => {
  it("groups by the first select property", () => {
    const config = initialBoardConfig([
      prop("a", "text"),
      prop("b", "select"),
      prop("c", "select"),
    ]);
    expect(config.groupByPropertyId).toBe("b");
  });

  it("prefers select over multi_select for the default group-by", () => {
    const config = initialBoardConfig([
      prop("m", "multi_select"),
      prop("s", "select"),
    ]);
    expect(config.groupByPropertyId).toBe("s");
  });

  it("leaves group-by unset when there is no select property", () => {
    const config = initialBoardConfig([
      prop("a", "text"),
      prop("m", "multi_select"),
    ]);
    expect(config.groupByPropertyId).toBeUndefined();
  });

  it("hides relation columns by default and keeps the rest visible", () => {
    const config = initialBoardConfig([
      prop("s", "select"),
      prop("r", "relation"),
      prop("t", "text"),
    ]);
    expect(config.columns).toEqual([
      { propertyId: "s", visible: true },
      { propertyId: "r", visible: false },
      { propertyId: "t", visible: true },
    ]);
  });

  it("omits the columns config when there is no relation column to hide", () => {
    const config = initialBoardConfig([prop("s", "select"), prop("t", "text")]);
    expect(config.columns).toBeUndefined();
  });

  it("returns an empty config when there is nothing to seed", () => {
    expect(initialBoardConfig([prop("t", "text")])).toEqual({});
    expect(initialBoardConfig([])).toEqual({});
  });
});
