import { CSSProperties, RefObject, useEffect, useRef, useState } from "react";
import { Box, Text } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { draggable } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { usePagePeek } from "@/features/database/components/relation-peek/use-page-peek.tsx";
import { CalendarBar as BarData } from "./layout-rows";
import { CALENDAR_BAR_DRAG } from "./calendar-dnd";

// How a dropped calendar bar changes dates: move shifts the whole span by the
// drop delta; resize-start / resize-end set only that end to the dropped day.
export type CalendarBarDragMode = "move" | "resize-start" | "resize-end";

interface CalendarBarProps {
  bar: BarData;
  // Absolute positioning supplied by the week renderer (left/width/top).
  style?: CSSProperties;
  // The bar extends past this segment's edge (a multi-week span or a clipped
  // off-grid end); the corresponding corner stays square so it reads as joined.
  continuesLeft?: boolean;
  continuesRight?: boolean;
  // Show the left/right resize handles (multi-day bars in the grid). A handle
  // only appears on the segment that actually holds that true, on-grid end.
  resizable?: boolean;
}

// The drag payload a calendar bar hands to a day cell's drop target. The cell
// reads mode + startISO/endISO to move the whole span or set one end.
export interface CalendarBarDrag {
  context: typeof CALENDAR_BAR_DRAG;
  mode: CalendarBarDragMode;
  id: string;
  startDatePropertyId: string;
  endDatePropertyId: string | undefined;
  startISO: string;
  endISO: string;
}

// Register a drag source on `ref` carrying the given mode. Disabled refs (e.g. a
// hidden resize handle) register nothing.
function useBarDrag(
  ref: RefObject<HTMLElement>,
  bar: BarData,
  mode: CalendarBarDragMode,
  onDragChange: (dragging: boolean) => void,
  enabled: boolean,
) {
  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    return draggable({
      element: el,
      // Plain literal (not annotated CalendarBarDrag) so it stays assignable to
      // pragmatic-dnd's Record<string, unknown>; the drop side casts back.
      getInitialData: () => ({
        context: CALENDAR_BAR_DRAG,
        mode,
        id: bar.row.row.id,
        startDatePropertyId: bar.startDatePropertyId,
        endDatePropertyId: bar.endDatePropertyId,
        startISO: bar.startISO,
        endISO: bar.endISO,
      }),
      onDragStart: () => onDragChange(true),
      onDrop: () => onDragChange(false),
    });
  }, [
    ref,
    enabled,
    mode,
    onDragChange,
    bar.row.row.id,
    bar.startDatePropertyId,
    bar.endDatePropertyId,
    bar.startISO,
    bar.endISO,
  ]);
}

const HANDLE_W = 7;

// A single row rendered as a calendar bar segment: a draggable/clickable label
// flanked, on a multi-day bar's true ends, by resize handles. Clicking the label
// opens the row in the page-peek modal; dragging moves or resizes the span.
export function CalendarBar({
  bar,
  style,
  continuesLeft,
  continuesRight,
  resizable,
}: CalendarBarProps) {
  const { t } = useTranslation();
  const { open } = usePagePeek();
  const moveRef = useRef<HTMLDivElement>(null);
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  // Handles sit on the segment that carries the real, on-grid start/end — never
  // on a week-boundary continuation or a clipped off-grid edge.
  const showLeft = !!resizable && !continuesLeft;
  const showRight = !!resizable && !continuesRight;

  useBarDrag(moveRef, bar, "move", setDragging, !!bar.draggable);
  useBarDrag(leftRef, bar, "resize-start", setDragging, showLeft);
  useBarDrag(rightRef, bar, "resize-end", setDragging, showRight);

  const handleStyle: CSSProperties = {
    width: HANDLE_W,
    flexShrink: 0,
    cursor: "ew-resize",
    alignSelf: "stretch",
    background: "var(--mantine-color-blue-4)",
  };

  return (
    <Box
      data-testid="calendar-bar"
      data-row-id={bar.row.row.id}
      style={{
        display: "flex",
        alignItems: "stretch",
        overflow: "hidden",
        opacity: dragging ? 0.4 : 1,
        background: "var(--mantine-color-blue-light)",
        color: "var(--mantine-color-blue-9)",
        borderTopLeftRadius: continuesLeft ? 0 : 4,
        borderBottomLeftRadius: continuesLeft ? 0 : 4,
        borderTopRightRadius: continuesRight ? 0 : 4,
        borderBottomRightRadius: continuesRight ? 0 : 4,
        lineHeight: "16px",
        ...style,
      }}
    >
      {showLeft && (
        <div
          ref={leftRef}
          data-testid="calendar-bar-resize-start"
          aria-label={t("Resize start")}
          style={handleStyle}
        />
      )}
      <Text
        ref={moveRef}
        component="div"
        size="xs"
        truncate
        data-draggable={bar.draggable}
        // Open the row as a page preview in the centered modal peek (#94) rather
        // than navigating away; the modal host is mounted globally on page routes.
        onClick={() => open(bar.row.row.id, "modal")}
        style={{
          flex: 1,
          minWidth: 0,
          cursor: bar.draggable ? "grab" : "pointer",
          padding: "1px 6px",
        }}
      >
        {bar.row.row.title || t("Untitled")}
      </Text>
      {showRight && (
        <div
          ref={rightRef}
          data-testid="calendar-bar-resize-end"
          aria-label={t("Resize end")}
          style={handleStyle}
        />
      )}
    </Box>
  );
}

export default CalendarBar;
