import { describe, it, expect } from "vitest";
import dayjs from "dayjs";
import { layoutRows } from "./layout-rows";
import { monthGrid } from "./month-grid";
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

// June 2026: the grid runs Sun 2026-05-31 .. Sat 2026-07-04. Index 0 is
// 2026-05-31, index 1 is 2026-06-01, index 30 is 2026-06-30.
const CELLS = monthGrid(dayjs("2026-06-15"));
const idxOf = (iso: string) =>
  CELLS.findIndex((c) => c.format("YYYY-MM-DD") === iso);

describe("layoutRows", () => {
  it("excludes rows with no start date value", () => {
    expect(layoutRows([row("r1", [])], "start", "end", CELLS)).toEqual([]);
  });

  it("excludes all rows when no start property is configured", () => {
    const rows = [row("r1", [dateValue("start", "2026-06-10")])];
    expect(layoutRows(rows, undefined, "end", CELLS)).toEqual([]);
  });

  it("places a single-day draggable bar at the start date's grid index", () => {
    const rows = [row("r1", [dateValue("start", "2026-06-10")])];
    const bars = layoutRows(rows, "start", undefined, CELLS);
    expect(bars).toHaveLength(1);
    expect(bars[0]).toMatchObject({
      startIndex: idxOf("2026-06-10"),
      endIndex: idxOf("2026-06-10"),
      singleDay: true,
      draggable: true,
      dragPropertyIds: ["start"],
      startDatePropertyId: "start",
      endDatePropertyId: undefined,
      startISO: "2026-06-10",
      endISO: "2026-06-10",
      clippedStart: false,
      clippedEnd: false,
    });
    expect(bars[0].row.row.id).toBe("r1");
  });

  it("spans start..end across grid indices when an end date is set", () => {
    const rows = [
      row("r1", [
        dateValue("start", "2026-06-10"),
        dateValue("end", "2026-06-14"),
      ]),
    ];
    const bars = layoutRows(rows, "start", "end", CELLS);
    expect(bars[0]).toMatchObject({
      startIndex: idxOf("2026-06-10"),
      endIndex: idxOf("2026-06-14"),
      singleDay: false,
      draggable: true,
      dragPropertyIds: ["start", "end"],
      startDatePropertyId: "start",
      endDatePropertyId: "end",
      startISO: "2026-06-10",
      endISO: "2026-06-14",
    });
  });

  it("falls back to a single day when the end date is before the start", () => {
    const rows = [
      row("r1", [
        dateValue("start", "2026-06-10"),
        dateValue("end", "2026-06-05"),
      ]),
    ];
    const bars = layoutRows(rows, "start", "end", CELLS);
    expect(bars[0]).toMatchObject({
      startIndex: idxOf("2026-06-10"),
      endIndex: idxOf("2026-06-10"),
      singleDay: true,
      dragPropertyIds: ["start"],
      endISO: "2026-06-10",
    });
  });

  it("falls back to a single day when the end value is missing/invalid", () => {
    const rows = [
      row("r1", [
        dateValue("start", "2026-06-10"),
        dateValue("end", "not-a-date"),
      ]),
    ];
    const bars = layoutRows(rows, "start", "end", CELLS);
    expect(bars[0]).toMatchObject({
      singleDay: true,
      endIndex: idxOf("2026-06-10"),
    });
  });

  it("clips a span that starts before the grid and flags clippedStart", () => {
    const rows = [
      row("r1", [
        dateValue("start", "2026-05-20"),
        dateValue("end", "2026-06-03"),
      ]),
    ];
    const bars = layoutRows(rows, "start", "end", CELLS);
    expect(bars[0]).toMatchObject({
      startIndex: 0,
      endIndex: idxOf("2026-06-03"),
      clippedStart: true,
      clippedEnd: false,
      startISO: "2026-05-20",
      endISO: "2026-06-03",
    });
  });

  it("clips a span that ends after the grid and flags clippedEnd", () => {
    const rows = [
      row("r1", [
        dateValue("start", "2026-06-28"),
        dateValue("end", "2026-07-20"),
      ]),
    ];
    const bars = layoutRows(rows, "start", "end", CELLS);
    expect(bars[0]).toMatchObject({
      startIndex: idxOf("2026-06-28"),
      endIndex: CELLS.length - 1,
      clippedStart: false,
      clippedEnd: true,
    });
  });

  it("excludes a bar whose span is entirely outside the visible grid", () => {
    const rows = [
      row("r1", [
        dateValue("start", "2026-03-01"),
        dateValue("end", "2026-03-10"),
      ]),
    ];
    expect(layoutRows(rows, "start", "end", CELLS)).toEqual([]);
  });

  it("ignores invalid / empty start values", () => {
    const rows = [
      row("r1", [dateValue("start", "")]),
      row("r2", [dateValue("start", "not-a-date")]),
    ];
    expect(layoutRows(rows, "start", "end", CELLS)).toEqual([]);
  });

  it("places multiple rows (approval)", () => {
    const rows = [
      row("a", [dateValue("start", "2026-06-01")]),
      row("b", [
        dateValue("start", "2026-06-09"),
        dateValue("end", "2026-06-11"),
      ]),
      row("c", []),
    ];
    const bars = layoutRows(rows, "start", "end", CELLS);
    expect(
      bars.map((b) => ({
        id: b.row.row.id,
        startIndex: b.startIndex,
        endIndex: b.endIndex,
        singleDay: b.singleDay,
        dragPropertyIds: b.dragPropertyIds,
      })),
    ).toEqual([
      {
        id: "a",
        startIndex: idxOf("2026-06-01"),
        endIndex: idxOf("2026-06-01"),
        singleDay: true,
        dragPropertyIds: ["start"],
      },
      {
        id: "b",
        startIndex: idxOf("2026-06-09"),
        endIndex: idxOf("2026-06-11"),
        singleDay: false,
        dragPropertyIds: ["start", "end"],
      },
    ]);
  });
});
