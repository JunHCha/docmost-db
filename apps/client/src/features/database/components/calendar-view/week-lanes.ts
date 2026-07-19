import { CalendarBar } from "./layout-rows";

// One horizontal slice of a bar within a single week row. A bar that crosses a
// week boundary yields one segment per week it touches; lanes are packed per
// week, so a multi-week bar can sit on a different lane in each week (it reflows
// to fit each week's crowding — like a month-view calendar).
export interface WeekSegment {
  bar: CalendarBar;
  week: number; // week row index (grid index / 7)
  startCol: number; // 0..6 inclusive
  endCol: number; // 0..6 inclusive
  lane: number; // 0-based stacking row within the week
  continuesLeft: boolean; // the bar extends past this segment's left edge
  continuesRight: boolean; // ...its right edge
}

export interface PackedWeeks {
  // Segments for bars on a visible lane (lane < maxLanes).
  segments: WeekSegment[];
  // grid cell index -> number of bars hidden on that day because they landed on
  // a lane >= maxLanes in that week (drives each cell's own "+N more").
  overflow: Map<number, number>;
}

const weekOf = (index: number) => Math.floor(index / 7);

// Pack bars into stacking lanes independently per week, then emit per-week
// segments for the bars that fit within maxLanes. Packing per week (rather than
// with one global lane per bar) means a bar squeezed out in a crowded week is
// only hidden there: in a week where it fits it still renders, so a sparse cell
// never shows a phantom "+N more" for a bar that a different week crowded out.
//
// Within a week, bars are placed left-to-right (by start, then end, then input
// order for stability); a lane is free once its previous occupant ends before
// the new bar begins.
export function packBars(
  bars: CalendarBar[],
  weekCount: number,
  maxLanes: number,
): PackedWeeks {
  const order = new Map<CalendarBar, number>(bars.map((b, i) => [b, i]));
  const segments: WeekSegment[] = [];
  const overflow = new Map<number, number>();

  for (let w = 0; w < weekCount; w++) {
    const weekStart = w * 7;
    const weekEnd = weekStart + 6;

    // Bars intersecting this week, packed left-to-right.
    const weekBars = bars
      .filter((b) => b.startIndex <= weekEnd && b.endIndex >= weekStart)
      .sort(
        (a, b) =>
          a.startIndex - b.startIndex ||
          a.endIndex - b.endIndex ||
          order.get(a)! - order.get(b)!,
      );

    // laneEnd[lane] = the largest grid endIndex placed on that lane this week; a
    // lane is reusable once its previous occupant ends before the new bar.
    const laneEnd: number[] = [];

    for (const bar of weekBars) {
      let lane = 0;
      while (laneEnd[lane] !== undefined && laneEnd[lane] >= bar.startIndex) {
        lane++;
      }
      laneEnd[lane] = bar.endIndex;

      const startCol = Math.max(0, bar.startIndex - weekStart);
      const endCol = Math.min(6, bar.endIndex - weekStart);

      if (lane >= maxLanes) {
        // Count the hidden bar against each day it covers within this week.
        for (let c = weekStart + startCol; c <= weekStart + endCol; c++) {
          overflow.set(c, (overflow.get(c) ?? 0) + 1);
        }
        continue;
      }

      segments.push({
        bar,
        week: w,
        startCol,
        endCol,
        lane,
        continuesLeft: weekOf(bar.startIndex) < w || bar.clippedStart,
        continuesRight: weekOf(bar.endIndex) > w || bar.clippedEnd,
      });
    }
  }

  return { segments, overflow };
}
