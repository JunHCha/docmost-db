import { useEffect, useRef, useState } from "react";
import { Text } from "@mantine/core";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { draggable } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { buildPageUrl } from "@/features/page/page.utils.ts";
import { CalendarBar as BarData } from "./layout-rows";
import { CALENDAR_BAR_DRAG } from "./calendar-dnd";

interface CalendarBarProps {
  bar: BarData;
  spaceSlug?: string;
}

// A single row rendered as a calendar chip. Clicking opens the row as a full
// page; a single-date bar is draggable to move its date (multi-day spans are
// click-only — see layoutRows.draggable).
export function CalendarBar({ bar, spaceSlug }: CalendarBarProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || !bar.draggable) return;
    return draggable({
      element: el,
      getInitialData: () => ({
        id: bar.row.row.id,
        propertyIds: bar.dragPropertyIds,
        context: CALENDAR_BAR_DRAG,
      }),
      onDragStart: () => setDragging(true),
      onDrop: () => setDragging(false),
    });
  }, [bar.row.row.id, bar.draggable, bar.dragPropertyIds?.join(",")]);

  return (
    <Text
      ref={ref}
      component="div"
      size="xs"
      truncate
      data-testid="calendar-bar"
      data-row-id={bar.row.row.id}
      data-draggable={bar.draggable}
      onClick={() =>
        navigate(buildPageUrl(spaceSlug, bar.row.row.slugId, bar.row.row.title))
      }
      style={{
        cursor: bar.draggable ? "grab" : "pointer",
        opacity: dragging ? 0.4 : 1,
        background: "var(--mantine-color-blue-light)",
        borderRadius: 4,
        padding: "1px 6px",
      }}
    >
      {bar.row.row.title || t("Untitled")}
    </Text>
  );
}

export default CalendarBar;
