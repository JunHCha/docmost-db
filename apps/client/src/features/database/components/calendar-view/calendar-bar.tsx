import { CSSProperties, useEffect, useRef, useState } from "react";
import { Text } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { draggable } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { usePagePeek } from "@/features/database/components/relation-peek/use-page-peek.tsx";
import { CalendarBar as BarData } from "./layout-rows";
import { CALENDAR_BAR_DRAG } from "./calendar-dnd";

interface CalendarBarProps {
  bar: BarData;
  // Absolute positioning supplied by the week renderer (left/width/top).
  style?: CSSProperties;
  // The bar extends past this segment's edge (a multi-week span or a clipped
  // off-grid end); the corresponding corner stays square so it reads as joined.
  continuesLeft?: boolean;
  continuesRight?: boolean;
}

// The drag payload a calendar bar hands to a day cell's drop target. The cell
// computes the drop delta from startISO and shifts both date properties by it,
// so a multi-day span moves whole while a single-day bar just changes its date.
export interface CalendarBarDrag {
  context: typeof CALENDAR_BAR_DRAG;
  id: string;
  startDatePropertyId: string;
  endDatePropertyId: string | undefined;
  startISO: string;
  endISO: string;
}

// A single row rendered as a calendar bar segment. Clicking opens the row as a
// full page; the bar is draggable to move its date(s) — see CalendarBarDrag.
export function CalendarBar({
  bar,
  style,
  continuesLeft,
  continuesRight,
}: CalendarBarProps) {
  const { t } = useTranslation();
  const { open } = usePagePeek();
  const ref = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || !bar.draggable) return;
    return draggable({
      element: el,
      // Returned as a plain literal (not annotated CalendarBarDrag) so it stays
      // assignable to pragmatic-dnd's Record<string, unknown>; the drop side
      // casts back to CalendarBarDrag.
      getInitialData: () => ({
        context: CALENDAR_BAR_DRAG,
        id: bar.row.row.id,
        startDatePropertyId: bar.startDatePropertyId,
        endDatePropertyId: bar.endDatePropertyId,
        startISO: bar.startISO,
        endISO: bar.endISO,
      }),
      onDragStart: () => setDragging(true),
      onDrop: () => setDragging(false),
    });
  }, [
    bar.row.row.id,
    bar.draggable,
    bar.startDatePropertyId,
    bar.endDatePropertyId,
    bar.startISO,
    bar.endISO,
  ]);

  return (
    <Text
      ref={ref}
      component="div"
      size="xs"
      truncate
      data-testid="calendar-bar"
      data-row-id={bar.row.row.id}
      data-draggable={bar.draggable}
      // Open the row as a page preview in the centered modal peek (#94), the
      // same host relation chips use — rather than navigating away from the
      // calendar. The modal host is mounted globally on page routes.
      onClick={() => open(bar.row.row.id, "modal")}
      style={{
        cursor: bar.draggable ? "grab" : "pointer",
        opacity: dragging ? 0.4 : 1,
        background: "var(--mantine-color-blue-light)",
        color: "var(--mantine-color-blue-9)",
        borderTopLeftRadius: continuesLeft ? 0 : 4,
        borderBottomLeftRadius: continuesLeft ? 0 : 4,
        borderTopRightRadius: continuesRight ? 0 : 4,
        borderBottomRightRadius: continuesRight ? 0 : 4,
        padding: "1px 6px",
        lineHeight: "16px",
        ...style,
      }}
    >
      {bar.row.row.title || t("Untitled")}
    </Text>
  );
}

export default CalendarBar;
