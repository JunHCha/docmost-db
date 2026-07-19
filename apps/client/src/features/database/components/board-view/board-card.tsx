import { useEffect, useRef, useState } from "react";
import { Card, Group, Stack, Text } from "@mantine/core";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import clsx from "clsx";
import { draggable } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import {
  IDatabaseProperty,
  IDatabaseRow,
} from "@/features/database/types/database.types.ts";
import { buildPageUrl } from "@/features/page/page.utils.ts";
import { GridCell } from "../table-view/grid-cell";
import { PropertyTypeIcon } from "../property/property-type-icon";
import { BOARD_CARD_DRAG } from "./board-dnd";
import classes from "./board-card.module.css";

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
//
// Design borrowed from the ee/base kanban card (#3): a bordered, shadowed tile
// whose fields each carry a dimmed type-icon + name caption, so a value is never
// ambiguous about which column it belongs to.
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
      padding="xs"
      radius="sm"
      data-testid="board-card"
      data-row-id={row.row.id}
      className={clsx(classes.card, dragging && classes.cardDragging)}
      onClick={() =>
        navigate(buildPageUrl(spaceSlug, row.row.slugId, row.row.title))
      }
    >
      <Stack gap={8}>
        <Text size="sm" fw={500} c={row.row.title ? undefined : "dimmed"}>
          {row.row.title || t("Untitled")}
        </Text>
        {cardProperties.map((property) => (
          <div
            key={property.id}
            className={classes.field}
            onClick={(e) => e.stopPropagation()}
          >
            <Group gap={4} wrap="nowrap" className={classes.fieldLabel}>
              <PropertyTypeIcon type={property.type} size={12} />
              <span className={classes.fieldLabelText}>{property.name}</span>
            </Group>
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
