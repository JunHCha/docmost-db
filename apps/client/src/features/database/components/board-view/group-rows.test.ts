import { describe, it, expect } from "vitest";
import { groupRows } from "./group-rows";
import {
  IDatabaseProperty,
  IDatabaseRow,
} from "@/features/database/types/database.types.ts";

function property(
  type: "select" | "multi_select",
  options: { id: string; label: string }[],
): IDatabaseProperty {
  return {
    id: "status",
    databaseId: "db1",
    name: "Status",
    type,
    config: { options },
    position: "a0",
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };
}

function row(id: string, value: unknown): IDatabaseRow {
  return {
    row: { id, title: id, slugId: id } as any,
    values:
      value === undefined
        ? []
        : [
            {
              id: `v-${id}`,
              pageId: id,
              propertyId: "status",
              value: { type: "select", value } as any,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
  };
}

const options = [
  { id: "todo", label: "To do" },
  { id: "doing", label: "In progress" },
  { id: "done", label: "Done" },
];

describe("groupRows", () => {
  it("buckets a select row into the column for its option id", () => {
    const prop = property("select", options);
    const result = groupRows([row("r1", "todo")], prop);
    const todo = result.groups.find((g) => g.option.id === "todo");
    expect(todo?.rows.map((r) => r.row.id)).toEqual(["r1"]);
    expect(result.unassigned).toHaveLength(0);
  });

  it("places rows with no value into unassigned", () => {
    const prop = property("select", options);
    const result = groupRows([row("r1", undefined)], prop);
    expect(result.unassigned.map((r) => r.row.id)).toEqual(["r1"]);
  });

  it("places rows whose option id no longer exists into unassigned", () => {
    const prop = property("select", options);
    const result = groupRows([row("r1", "ghost")], prop);
    expect(result.unassigned.map((r) => r.row.id)).toEqual(["r1"]);
    result.groups.forEach((g) => expect(g.rows).toHaveLength(0));
  });

  it("orders columns by the property's option order", () => {
    const prop = property("select", options);
    const result = groupRows([], prop);
    expect(result.groups.map((g) => g.option.id)).toEqual([
      "todo",
      "doing",
      "done",
    ]);
  });

  it("keeps empty option columns as drop targets", () => {
    const prop = property("select", options);
    const result = groupRows([row("r1", "todo")], prop);
    const doing = result.groups.find((g) => g.option.id === "doing");
    expect(doing).toBeDefined();
    expect(doing?.rows).toHaveLength(0);
  });

  it("duplicates a multi_select row into every matching column", () => {
    const prop = property("multi_select", options);
    const r: IDatabaseRow = {
      row: { id: "r1", title: "r1", slugId: "r1" } as any,
      values: [
        {
          id: "v1",
          pageId: "r1",
          propertyId: "status",
          value: { type: "multi_select", value: ["todo", "done"] } as any,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    };
    const result = groupRows([r], prop);
    expect(
      result.groups.find((g) => g.option.id === "todo")?.rows.map((x) => x.row.id),
    ).toEqual(["r1"]);
    expect(
      result.groups.find((g) => g.option.id === "done")?.rows.map((x) => x.row.id),
    ).toEqual(["r1"]);
    expect(
      result.groups.find((g) => g.option.id === "doing")?.rows,
    ).toHaveLength(0);
    expect(result.unassigned).toHaveLength(0);
  });

  it("places a multi_select row with an empty array into unassigned", () => {
    const prop = property("multi_select", options);
    const r: IDatabaseRow = {
      row: { id: "r1", title: "r1", slugId: "r1" } as any,
      values: [
        {
          id: "v1",
          pageId: "r1",
          propertyId: "status",
          value: { type: "multi_select", value: [] } as any,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    };
    const result = groupRows([r], prop);
    expect(result.unassigned.map((x) => x.row.id)).toEqual(["r1"]);
  });
});
