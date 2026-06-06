import dayjs, { Dayjs } from "dayjs";
import { IDatabaseRow } from "@/features/database/types/database.types.ts";

const ISO = "YYYY-MM-DD";

// A row placed onto the visible month grid. startDay/endDay are 1-based days of
// the visible month, already clipped to the month's bounds. A bar is draggable
// only when it occupies a single date (start-only / end-only / start==end);
// multi-day spans are click-only. dragPropertyId names the date property a drop
// should rewrite (undefined for non-draggable spans).
export interface CalendarBar {
  row: IDatabaseRow;
  startDay: number;
  endDay: number;
  draggable: boolean;
  dragPropertyId?: string;
}

function parseDate(
  row: IDatabaseRow,
  propertyId: string | undefined,
): Dayjs | undefined {
  if (!propertyId) return undefined;
  const raw = row.values.find((v) => v.propertyId === propertyId)?.value?.value;
  // Date values are stored as ISO `YYYY-MM-DD` (see date-cell). Guard the shape
  // explicitly so we never depend on the customParseFormat plugin being loaded.
  if (typeof raw !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return undefined;
  }
  const d = dayjs(raw, ISO);
  return d.isValid() ? d : undefined;
}

export function layoutRows(
  rows: IDatabaseRow[],
  startDatePropertyId: string | undefined,
  endDatePropertyId: string | undefined,
  month: Dayjs,
): CalendarBar[] {
  const monthStart = month.startOf("month");
  const monthEnd = month.endOf("month");
  const daysInMonth = monthStart.daysInMonth();
  const bars: CalendarBar[] = [];

  for (const row of rows) {
    const start = parseDate(row, startDatePropertyId);
    const end = parseDate(row, endDatePropertyId);
    if (!start && !end) continue;

    let from: Dayjs;
    let to: Dayjs;
    let draggable: boolean;
    let dragPropertyId: string | undefined;

    if (start && end) {
      // Normalize reversed spans so from <= to.
      [from, to] = start.isAfter(end) ? [end, start] : [start, end];
      const single = from.isSame(to, "day");
      draggable = single;
      dragPropertyId = single ? startDatePropertyId : undefined;
    } else {
      const only = (start ?? end) as Dayjs;
      from = only;
      to = only;
      draggable = true;
      dragPropertyId = start ? startDatePropertyId : endDatePropertyId;
    }

    // Drop spans that do not intersect the visible month at all.
    if (to.isBefore(monthStart, "day") || from.isAfter(monthEnd, "day")) {
      continue;
    }

    const startDay = from.isBefore(monthStart, "day") ? 1 : from.date();
    const endDay = to.isAfter(monthEnd, "day") ? daysInMonth : to.date();

    bars.push({ row, startDay, endDay, draggable, dragPropertyId });
  }

  return bars;
}
