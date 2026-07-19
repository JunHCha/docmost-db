import dayjs, { Dayjs } from "dayjs";
import { IDatabaseRow } from "@/features/database/types/database.types.ts";

const ISO = "YYYY-MM-DD";

// A row placed onto the visible month grid. Positions are inclusive 0-based
// indices into the grid's `cells` array (monthGrid), already clipped to the
// visible range — so the renderer can map an index straight to a week row
// (index / 7) and column (index % 7) without re-deriving dates.
//
// A single-day bar (no end-date property, or an end value missing / not after
// the start) sits on one cell. A multi-day bar spans startIndex..endIndex; when
// its true span runs past a grid edge the clipped flag is set so the renderer
// can flatten that end (the bar reads as continuing off-screen).
//
// startISO/endISO carry the true (unclipped) dates so a whole-bar drag can shift
// both date properties by the drop delta while preserving the span.
export interface CalendarBar {
  row: IDatabaseRow;
  startIndex: number;
  endIndex: number;
  clippedStart: boolean;
  clippedEnd: boolean;
  singleDay: boolean;
  draggable: boolean;
  dragPropertyIds: string[];
  startDatePropertyId: string;
  endDatePropertyId: string | undefined;
  startISO: string;
  endISO: string;
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
  endDatePropertyId: string | undefined,
  cells: Dayjs[],
): CalendarBar[] {
  if (!datePropertyId || cells.length === 0) return [];

  const gridStart = cells[0];
  const lastIndex = cells.length - 1;
  const gridEnd = cells[lastIndex];

  const bars: CalendarBar[] = [];

  for (const row of rows) {
    const start = parseDate(row, datePropertyId);
    if (!start) continue;

    // The end date is optional: absent, unparseable, or before the start all
    // collapse the bar to a single day at the start.
    const rawEnd = parseDate(row, endDatePropertyId);
    const hasEnd =
      !!endDatePropertyId && !!rawEnd && !rawEnd.isBefore(start, "day");
    const end = hasEnd ? rawEnd! : start;

    // Skip bars whose true span never intersects the visible grid.
    if (start.isAfter(gridEnd, "day") || end.isBefore(gridStart, "day")) {
      continue;
    }

    // Cells are consecutive days, so a date's grid index is its day offset from
    // the first cell; clip to [0, lastIndex] and remember which ends we cut.
    const rawStartIndex = start.diff(gridStart, "day");
    const rawEndIndex = end.diff(gridStart, "day");
    const startIndex = Math.max(0, rawStartIndex);
    const endIndex = Math.min(lastIndex, rawEndIndex);

    bars.push({
      row,
      startIndex,
      endIndex,
      clippedStart: rawStartIndex < 0,
      clippedEnd: rawEndIndex > lastIndex,
      singleDay: !hasEnd,
      draggable: true,
      dragPropertyIds: hasEnd
        ? [datePropertyId, endDatePropertyId!]
        : [datePropertyId],
      startDatePropertyId: datePropertyId,
      endDatePropertyId: hasEnd ? endDatePropertyId : undefined,
      startISO: start.format(ISO),
      endISO: end.format(ISO),
    });
  }

  return bars;
}
