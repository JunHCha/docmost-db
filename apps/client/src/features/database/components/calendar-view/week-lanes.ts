import { CalendarBar } from "./layout-rows";

// One horizontal slice of a bar within a single week row. A bar that crosses a
// week boundary yields one segment per week it touches; all its segments share
// the same lane so the bar reads as one continuous strip down the grid.
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
  // Segments for bars on a visible lane (lane < maxLanes), in input order.
  segments: WeekSegment[];
  // grid cell index -> number of bars hidden on that day because they landed on
  // a lane >= maxLanes (drives each cell's own "+N more" indicator).
  overflow: Map<number, number>;
}

const weekOf = (index: number) => Math.floor(index / 7);

// Assign each bar the lowest lane that is free across every week it spans, then
// emit per-week segments for the bars that fit within maxLanes. Bars are placed
// in the order given (layoutRows preserves row order), so lane assignment is
// stable. A lane is free in a week when no already-placed bar sharing that lane
// still occupies a column at or after this bar's start.
export function packBars(
  bars: CalendarBar[],
  weekCount: number,
  maxLanes: number,
): PackedWeeks {
  // laneEnd[week][lane] = the largest grid endIndex placed on that lane in that
  // week; a lane is reusable once its previous occupant ends before the new bar.
  const laneEnd: Array<Map<number, number>> = Array.from(
    { length: weekCount },
    () => new Map<number, number>(),
  );

  const segments: WeekSegment[] = [];
  const overflow = new Map<number, number>();

  for (const bar of bars) {
    const firstWeek = weekOf(bar.startIndex);
    const lastWeek = weekOf(bar.endIndex);

    // Find the lowest lane free in all weeks this bar touches.
    let lane = 0;
    for (;;) {
      let fits = true;
      for (let w = firstWeek; w <= lastWeek; w++) {
        const end = laneEnd[w]?.get(lane);
        if (end !== undefined && end >= bar.startIndex) {
          fits = false;
          break;
        }
      }
      if (fits) break;
      lane++;
    }

    // Reserve the lane across every touched week regardless of visibility, so a
    // hidden bar still blocks the lane it would have used.
    for (let w = firstWeek; w <= lastWeek; w++) {
      laneEnd[w]?.set(lane, bar.endIndex);
    }

    if (lane >= maxLanes) {
      // Count the hidden bar against every day it covers, so each cell shows its
      // own overflow rather than one indicator for the whole week.
      for (let c = bar.startIndex; c <= bar.endIndex; c++) {
        overflow.set(c, (overflow.get(c) ?? 0) + 1);
      }
      continue;
    }

    for (let w = firstWeek; w <= lastWeek; w++) {
      const weekStart = w * 7;
      const startCol = Math.max(0, bar.startIndex - weekStart);
      const endCol = Math.min(6, bar.endIndex - weekStart);
      segments.push({
        bar,
        week: w,
        startCol,
        endCol,
        lane,
        continuesLeft: w > firstWeek || bar.clippedStart,
        continuesRight: w < lastWeek || bar.clippedEnd,
      });
    }
  }

  return { segments, overflow };
}
