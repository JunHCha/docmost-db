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
  it("excludes rows with neither start nor end value", () => {
    const rows = [row("r1", [])];
    expect(layoutRows(rows, "start", "end", MONTH)).toEqual([]);
  });

  it("excludes rows when no date property is configured", () => {
    const rows = [row("r1", [dateValue("start", "2026-06-10")])];
    expect(layoutRows(rows, undefined, undefined, MONTH)).toEqual([]);
  });

  it("places a single-day draggable bar when only start is set", () => {
    const rows = [row("r1", [dateValue("start", "2026-06-10")])];
    const bars = layoutRows(rows, "start", "end", MONTH);
    expect(bars).toHaveLength(1);
    expect(bars[0]).toMatchObject({
      startDay: 10,
      endDay: 10,
      draggable: true,
      dragPropertyId: "start",
    });
    expect(bars[0].row.row.id).toBe("r1");
  });

  it("places a single-day draggable bar when only end is set", () => {
    const rows = [row("r1", [dateValue("end", "2026-06-20")])];
    const bars = layoutRows(rows, "start", "end", MONTH);
    expect(bars[0]).toMatchObject({
      startDay: 20,
      endDay: 20,
      draggable: true,
      dragPropertyId: "end",
    });
  });

  it("treats start==end as a single-day draggable bar", () => {
    const rows = [
      row("r1", [
        dateValue("start", "2026-06-12"),
        dateValue("end", "2026-06-12"),
      ]),
    ];
    const bars = layoutRows(rows, "start", "end", MONTH);
    expect(bars[0]).toMatchObject({
      startDay: 12,
      endDay: 12,
      draggable: true,
    });
  });

  it("spans start..end as a non-draggable multi-day bar", () => {
    const rows = [
      row("r1", [
        dateValue("start", "2026-06-10"),
        dateValue("end", "2026-06-14"),
      ]),
    ];
    const bars = layoutRows(rows, "start", "end", MONTH);
    expect(bars[0]).toMatchObject({
      startDay: 10,
      endDay: 14,
      draggable: false,
    });
  });

  it("clips a span that starts before the visible month", () => {
    const rows = [
      row("r1", [
        dateValue("start", "2026-05-28"),
        dateValue("end", "2026-06-03"),
      ]),
    ];
    const bars = layoutRows(rows, "start", "end", MONTH);
    expect(bars[0]).toMatchObject({ startDay: 1, endDay: 3, draggable: false });
  });

  it("clips a span that ends after the visible month", () => {
    const rows = [
      row("r1", [
        dateValue("start", "2026-06-28"),
        dateValue("end", "2026-07-05"),
      ]),
    ];
    const bars = layoutRows(rows, "start", "end", MONTH);
    expect(bars[0]).toMatchObject({ startDay: 28, endDay: 30, draggable: false });
  });

  it("excludes a span entirely outside the visible month", () => {
    const rows = [
      row("r1", [
        dateValue("start", "2026-07-01"),
        dateValue("end", "2026-07-10"),
      ]),
    ];
    expect(layoutRows(rows, "start", "end", MONTH)).toEqual([]);
  });

  it("excludes a single-day bar in another month", () => {
    const rows = [row("r1", [dateValue("start", "2026-05-10")])];
    expect(layoutRows(rows, "start", "end", MONTH)).toEqual([]);
  });

  it("ignores invalid / empty date values", () => {
    const rows = [
      row("r1", [dateValue("start", "")]),
      row("r2", [dateValue("start", "not-a-date")]),
    ];
    expect(layoutRows(rows, "start", "end", MONTH)).toEqual([]);
  });

  it("normalizes a reversed span (end before start)", () => {
    const rows = [
      row("r1", [
        dateValue("start", "2026-06-14"),
        dateValue("end", "2026-06-10"),
      ]),
    ];
    const bars = layoutRows(rows, "start", "end", MONTH);
    expect(bars[0]).toMatchObject({ startDay: 10, endDay: 14, draggable: false });
  });

  it("falls back to the single configured property", () => {
    const rows = [row("r1", [dateValue("start", "2026-06-10")])];
    // only start property configured; end undefined
    const bars = layoutRows(rows, "start", undefined, MONTH);
    expect(bars[0]).toMatchObject({
      startDay: 10,
      endDay: 10,
      draggable: true,
      dragPropertyId: "start",
    });
  });

  it("places multiple rows (approval)", () => {
    const rows = [
      row("a", [dateValue("start", "2026-06-01")]),
      row("b", [
        dateValue("start", "2026-06-05"),
        dateValue("end", "2026-06-09"),
      ]),
      row("c", []),
    ];
    const bars = layoutRows(rows, "start", "end", MONTH);
    expect(
      bars.map((b) => ({
        id: b.row.row.id,
        startDay: b.startDay,
        endDay: b.endDay,
        draggable: b.draggable,
      })),
    ).toEqual([
      { id: "a", startDay: 1, endDay: 1, draggable: true },
      { id: "b", startDay: 5, endDay: 9, draggable: false },
    ]);
  });
});
