import { useEffect, useRef, useState } from "react";
import { Card, Stack, Text } from "@mantine/core";
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

// Types whose value already reads as its own kind — coloured pills and avatars —
// so a leading type icon would be noise. They render the value alone.
const SELF_EVIDENT_TYPES = new Set(["select", "multi_select", "person"]);

// One compact line per property: a dimmed type-icon hint + the value. checkbox
// is special-cased into a labelled boolean (the toggle + the property name),
// since a lone checkbox on a card says nothing about which column it is.
function BoardCardField({
  property,
  value,
  databaseId,
  pageId,
}: {
  property: IDatabaseProperty;
  value: IDatabaseRow["values"][number] | undefined;
  databaseId: string;
  pageId: string;
}) {
  const cell = (
    <GridCell
      property={property}
      value={value}
      pageId={pageId}
      databaseId={databaseId}
    />
  );

  if (property.type === "checkbox") {
    return (
      <div className={classes.field} onClick={(e) => e.stopPropagation()}>
        {cell}
        <span className={classes.checkboxLabel}>{property.name}</span>
      </div>
    );
  }

  const showIcon = !SELF_EVIDENT_TYPES.has(property.type);
  return (
    <div className={classes.field} onClick={(e) => e.stopPropagation()}>
      {showIcon && (
        <PropertyTypeIcon
          type={property.type}
          size={14}
          className={classes.fieldIcon}
        />
      )}
      <div className={classes.fieldValue}>{cell}</div>
    </div>
  );
}

// A single row rendered as a draggable card. Clicking opens the row as a full
// page (#9); dragging it to another column re-buckets it (handled by the
// column drop target via the source id).
//
// Design borrowed from the ee/base kanban card (#3): a bordered, shadowed tile
// whose fields sit on one compact line each, an icon hinting the type where the
// value isn't self-describing.
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
          <BoardCardField
            key={property.id}
            property={property}
            value={row.values.find((v) => v.propertyId === property.id)}
            pageId={row.row.id}
            databaseId={databaseId}
          />
        ))}
      </Stack>
    </Card>
  );
}

export default BoardCard;
