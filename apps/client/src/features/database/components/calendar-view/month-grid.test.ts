import { describe, it, expect } from "vitest";
import dayjs from "dayjs";
import { monthGrid } from "./month-grid";

describe("monthGrid", () => {
  it("returns whole weeks (multiples of 7) covering the month", () => {
    // June 2026: 30 days, starts on a Monday.
    const cells = monthGrid(dayjs("2026-06-15"));
    expect(cells.length % 7).toBe(0);
    expect(cells.length).toBeGreaterThanOrEqual(35);
  });

  it("starts on a Sunday and contains every day of the month", () => {
    const cells = monthGrid(dayjs("2026-06-15"));
    expect(cells[0].day()).toBe(0); // Sunday
    const inMonth = cells.filter((d) => d.month() === 5); // June = month index 5
    expect(inMonth).toHaveLength(30);
    expect(inMonth[0].date()).toBe(1);
    expect(inMonth[29].date()).toBe(30);
  });

  it("pads leading and trailing days from adjacent months", () => {
    const cells = monthGrid(dayjs("2026-06-15"));
    // June 1 2026 is a Monday, so one leading cell (May 31).
    expect(cells[0].month()).toBe(4); // May
    expect(cells[cells.length - 1].month()).not.toBe(5);
  });
});
