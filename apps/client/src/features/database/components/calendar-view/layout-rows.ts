import dayjs, { Dayjs } from "dayjs";
import { IDatabaseRow } from "@/features/database/types/database.types.ts";

const ISO = "YYYY-MM-DD";

// A row placed onto the visible month grid. Every bar occupies a single date
// (startDay === endDay, the 1-based day-of-month of its date property) and is
// always draggable. dragPropertyIds names the date property a drop should
// rewrite to the dropped day.
export interface CalendarBar {
  row: IDatabaseRow;
  startDay: number;
  endDay: number;
  draggable: boolean;
  dragPropertyIds?: string[];
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
  datePropertyId: string | undefined,
  month: Dayjs,
): CalendarBar[] {
  if (!datePropertyId) return [];

  const bars: CalendarBar[] = [];

  for (const row of rows) {
    const date = parseDate(row, datePropertyId);
    // Skip rows with no (or unparseable) date, and dates outside this month.
    if (!date || !date.isSame(month, "month")) continue;

    const day = date.date();
    bars.push({
      row,
      startDay: day,
      endDay: day,
      draggable: true,
      dragPropertyIds: [datePropertyId],
    });
  }

  return bars;
}
