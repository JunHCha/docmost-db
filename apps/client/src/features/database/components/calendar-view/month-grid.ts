import { Dayjs } from "dayjs";

// All day cells of the visible month grid, Sunday-first, padded with adjacent
// months' days so the result is always whole weeks (a multiple of 7). Bars are
// placed by their 1-based day-of-month (layoutRows); cells from other months
// render dimmed and carry no bars.
export function monthGrid(month: Dayjs): Dayjs[] {
  const start = month.startOf("month").day(0); // back to Sunday
  const end = month.endOf("month");
  // Pad the tail to the Saturday of the last week.
  const gridEnd = end.day(6);
  const cells: Dayjs[] = [];
  let cursor = start;
  while (!cursor.isAfter(gridEnd, "day")) {
    cells.push(cursor);
    cursor = cursor.add(1, "day");
  }
  return cells;
}
