import { useEffect, useRef, useState } from "react";
import { Card, Stack, Text } from "@mantine/core";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { draggable } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import {
  IDatabaseProperty,
  IDatabaseRow,
} from "@/features/database/types/database.types.ts";
import { buildPageUrl } from "@/features/page/page.utils.ts";
import { GridCell } from "../table-view/grid-cell";
import { BOARD_CARD_DRAG } from "./board-dnd";

interface BoardCardProps {
  row: IDatabaseRow;
  databaseId: string;
  // Properties to render under the title (the group-by property is excluded by
  // the column, since the column itself already encodes that value).
  cardProperties: IDatabaseProperty[];
  spaceSlug?: string;
}

// A single row rendered as a draggable card. Clicking opens the row as a full
// page (#9); dragging it to another column re-buckets it (handled by the
// column drop target via the source id).
export function BoardCard({
  row,
  databaseId,
  cardProperties,
  spaceSlug,
}: BoardCardProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return draggable({
      element: el,
      getInitialData: () => ({ id: row.row.id, context: BOARD_CARD_DRAG }),
      onDragStart: () => setDragging(true),
      onDrop: () => setDragging(false),
    });
  }, [row.row.id]);

  return (
    <Card
      ref={ref}
      withBorder
      padding="xs"
      radius="sm"
      data-testid="board-card"
      data-row-id={row.row.id}
      style={{ cursor: "pointer", opacity: dragging ? 0.4 : 1 }}
      onClick={() =>
        navigate(buildPageUrl(spaceSlug, row.row.slugId, row.row.title))
      }
    >
      <Stack gap={4}>
        <Text size="sm" fw={500} c={row.row.title ? undefined : "dimmed"}>
          {row.row.title || t("Untitled")}
        </Text>
        {cardProperties.map((property) => (
          <div key={property.id} onClick={(e) => e.stopPropagation()}>
            <GridCell
              property={property}
              value={row.values.find((v) => v.propertyId === property.id)}
              pageId={row.row.id}
              databaseId={databaseId}
            />
          </div>
        ))}
      </Stack>
    </Card>
  );
}

export default BoardCard;
