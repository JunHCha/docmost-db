import { describe, it, expect } from "vitest";
import dayjs from "dayjs";
import { layoutRows } from "./layout-rows";
import {
  IDatabaseRow,
  IDatabasePropertyValue,
} from "@/features/database/types/database.types.ts";

function dateValue(propertyId: string, iso: string): IDatabasePropertyValue {
  return {
    id: `${propertyId}-v`,
    pageId: "p",
    propertyId,
    value: { type: "date", value: iso },
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function row(id: string, values: IDatabasePropertyValue[]): IDatabaseRow {
  return {
    row: {
      id,
      slugId: id,
      title: id,
    } as IDatabaseRow["row"],
    values: values.map((v) => ({ ...v, pageId: id, id: `${id}-${v.propertyId}` })),
  };
}

// All tests anchor on June 2026 (a 30-day month).
const MONTH = dayjs("2026-06-15");

describe("layoutRows", () => {
  it("excludes rows with no date value", () => {
    const rows = [row("r1", [])];
    expect(layoutRows(rows, "date", MONTH)).toEqual([]);
  });

  it("excludes all rows when no date property is configured", () => {
    const rows = [row("r1", [dateValue("date", "2026-06-10")])];
    expect(layoutRows(rows, undefined, MONTH)).toEqual([]);
  });

  it("places a single-day draggable bar carrying the date property id", () => {
    const rows = [row("r1", [dateValue("date", "2026-06-10")])];
    const bars = layoutRows(rows, "date", MONTH);
    expect(bars).toHaveLength(1);
    expect(bars[0]).toMatchObject({
      startDay: 10,
      endDay: 10,
      draggable: true,
      dragPropertyIds: ["date"],
    });
    expect(bars[0].row.row.id).toBe("r1");
  });

  it("excludes a bar in another month", () => {
    const rows = [row("r1", [dateValue("date", "2026-05-10")])];
    expect(layoutRows(rows, "date", MONTH)).toEqual([]);
  });

  it("excludes a bar in a later month", () => {
    const rows = [row("r1", [dateValue("date", "2026-07-10")])];
    expect(layoutRows(rows, "date", MONTH)).toEqual([]);
  });

  it("ignores invalid / empty date values", () => {
    const rows = [
      row("r1", [dateValue("date", "")]),
      row("r2", [dateValue("date", "not-a-date")]),
    ];
    expect(layoutRows(rows, "date", MONTH)).toEqual([]);
  });

  it("places multiple rows (approval)", () => {
    const rows = [
      row("a", [dateValue("date", "2026-06-01")]),
      row("b", [dateValue("date", "2026-06-09")]),
      row("c", []),
    ];
    const bars = layoutRows(rows, "date", MONTH);
    expect(
      bars.map((b) => ({
        id: b.row.row.id,
        startDay: b.startDay,
        endDay: b.endDay,
        draggable: b.draggable,
        dragPropertyIds: b.dragPropertyIds,
      })),
    ).toEqual([
      { id: "a", startDay: 1, endDay: 1, draggable: true, dragPropertyIds: ["date"] },
      { id: "b", startDay: 9, endDay: 9, draggable: true, dragPropertyIds: ["date"] },
    ]);
  });
});
