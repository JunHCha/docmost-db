import { describe, it, expect } from "vitest";
import { packBars } from "./week-lanes";
import { CalendarBar } from "./layout-rows";

// Minimal bar factory — packing only reads index/clip fields, not the row.
function bar(
  id: string,
  startIndex: number,
  endIndex: number,
  clip: { start?: boolean; end?: boolean } = {},
): CalendarBar {
  return {
    row: { row: { id } } as CalendarBar["row"],
    startIndex,
    endIndex,
    clippedStart: clip.start ?? false,
    clippedEnd: clip.end ?? false,
    singleDay: startIndex === endIndex,
    draggable: true,
    dragPropertyIds: ["start"],
    startDatePropertyId: "start",
    endDatePropertyId: undefined,
    startISO: "2026-06-01",
    endISO: "2026-06-01",
  };
}

// A 5-week grid (indices 0..34). Week w covers indices [w*7 .. w*7+6].
const WEEKS = 5;

describe("packBars", () => {
  it("returns no segments when there are no bars", () => {
    const { segments, overflow } = packBars([], WEEKS, 3);
    expect(segments).toEqual([]);
    expect(overflow.size).toBe(0);
  });

  it("places a single-week bar as one segment on lane 0", () => {
    // indices 8..10 → week 1, cols 1..3.
    const { segments } = packBars([bar("a", 8, 10)], WEEKS, 3);
    expect(segments).toHaveLength(1);
    expect(segments[0]).toMatchObject({
      week: 1,
      startCol: 1,
      endCol: 3,
      lane: 0,
      continuesLeft: false,
      continuesRight: false,
    });
  });

  it("splits a bar crossing a week boundary into one segment per week", () => {
    // indices 5..9 → week 0 cols 5..6, week 1 cols 0..2.
    const { segments } = packBars([bar("a", 5, 9)], WEEKS, 3);
    const byWeek = segments.sort((x, y) => x.week - y.week);
    expect(byWeek).toHaveLength(2);
    expect(byWeek[0]).toMatchObject({
      week: 0,
      startCol: 5,
      endCol: 6,
      continuesLeft: false,
      continuesRight: true,
    });
    expect(byWeek[1]).toMatchObject({
      week: 1,
      startCol: 0,
      endCol: 2,
      continuesLeft: true,
      continuesRight: false,
    });
    // Same bar keeps one consistent lane across both weeks.
    expect(byWeek[0].lane).toBe(byWeek[1].lane);
  });

  it("stacks overlapping bars onto separate lanes", () => {
    const bars = [bar("a", 8, 12), bar("b", 10, 13)];
    const { segments } = packBars(bars, WEEKS, 3);
    const laneOf = (id: string) =>
      segments.find((s) => s.bar.row.row.id === id)!.lane;
    expect(laneOf("a")).toBe(0);
    expect(laneOf("b")).toBe(1);
  });

  it("reuses a lane for non-overlapping bars in the same week", () => {
    const bars = [bar("a", 7, 8), bar("b", 10, 11)];
    const { segments } = packBars(bars, WEEKS, 3);
    expect(segments.every((s) => s.lane === 0)).toBe(true);
  });

  it("flags clipped ends as continuing off-grid", () => {
    const { segments } = packBars(
      [bar("a", 0, 2, { start: true })],
      WEEKS,
      3,
    );
    expect(segments[0]).toMatchObject({
      week: 0,
      continuesLeft: true,
      continuesRight: false,
    });
  });

  it("hides bars beyond maxLanes and counts them per covered cell", () => {
    // Four mutually overlapping bars over cells 7..9, maxLanes 3 → one overflows.
    const bars = [
      bar("a", 7, 9),
      bar("b", 7, 9),
      bar("c", 7, 9),
      bar("d", 7, 9),
    ];
    const { segments, overflow } = packBars(bars, WEEKS, 3);
    // Only the first three lanes render.
    expect(segments.every((s) => s.lane < 3)).toBe(true);
    expect(segments).toHaveLength(3);
    // The hidden bar (d) is counted against each day it covers: cells 7, 8, 9.
    expect(overflow.get(7)).toBe(1);
    expect(overflow.get(8)).toBe(1);
    expect(overflow.get(9)).toBe(1);
  });

  it("does not overflow a sparse week just because another week is crowded", () => {
    // Cell 6 (end of week 0) is crowded by three single-day bars; a long bar B
    // starts there and runs into week 1 (cells 6..10). B is squeezed out of the
    // visible lanes in week 0, but week 1 has room, so its week-1 cells must show
    // B rather than a phantom "+1 more".
    const bars = [
      bar("a", 6, 6),
      bar("b", 6, 6),
      bar("c", 6, 6),
      bar("B", 6, 10),
    ];
    const { segments, overflow } = packBars(bars, WEEKS, 3);
    // Week 0 (cell 6) is genuinely full: B overflows there.
    expect(overflow.get(6)).toBe(1);
    // Week 1 cells 7..10 have room, so no overflow and B renders there.
    expect(overflow.get(7)).toBeUndefined();
    const week1B = segments.find(
      (s) => s.bar.row.row.id === "B" && s.week === 1,
    );
    expect(week1B).toBeTruthy();
    expect(week1B!.lane).toBeLessThan(3);
  });

  it("counts overflow only on the days a hidden bar actually covers", () => {
    // Three lane-fillers span cells 7..9; a hidden bar sits only on cell 8.
    const bars = [
      bar("a", 7, 9),
      bar("b", 7, 9),
      bar("c", 7, 9),
      bar("d", 8, 8),
    ];
    const { overflow } = packBars(bars, WEEKS, 3);
    expect(overflow.get(8)).toBe(1);
    expect(overflow.has(7)).toBe(false);
    expect(overflow.has(9)).toBe(false);
  });
});
