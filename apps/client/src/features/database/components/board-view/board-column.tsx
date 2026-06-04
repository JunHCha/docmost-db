import { useEffect, useRef, useState } from "react";
import { Box, Button, Group, Stack, Text } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { dropTargetForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import {
  IDatabaseProperty,
  IDatabaseRow,
} from "@/features/database/types/database.types.ts";
import { OptionPill } from "../property/option-pill";
import { BoardCard } from "./board-card";
import { BOARD_CARD_DRAG } from "./board-dnd";

interface BoardColumnProps {
  // null label = the trailing "No <property>" (unassigned) column.
  optionId: string | null;
  label: string;
  color?: string;
  rows: IDatabaseRow[];
  databaseId: string;
  cardProperties: IDatabaseProperty[];
  spaceSlug?: string;
  // Drops a card (by row id) into this column; board-view maps it to set/clear.
  onDropCard: (rowId: string) => void;
  // Creates a new row already assigned to this column's option.
  onCreate: () => void;
}

export function BoardColumn({
  optionId,
  label,
  color,
  rows,
  databaseId,
  cardProperties,
  spaceSlug,
  onDropCard,
  onCreate,
}: BoardColumnProps) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const [over, setOver] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return dropTargetForElements({
      element: el,
      canDrop: ({ source }) => source.data.context === BOARD_CARD_DRAG,
      onDragEnter: () => setOver(true),
      onDragLeave: () => setOver(false),
      onDrop: ({ source }) => {
        setOver(false);
        onDropCard(source.data.id as string);
      },
    });
  }, [onDropCard]);

  return (
    <Box
      ref={ref}
      data-testid="board-column"
      data-option-id={optionId ?? "unassigned"}
      style={{
        width: 280,
        flexShrink: 0,
        background: over
          ? "var(--mantine-color-blue-light)"
          : "var(--mantine-color-gray-light)",
        borderRadius: 8,
        padding: 8,
      }}
    >
      <Group justify="space-between" mb="xs" px={4}>
        {optionId === null ? (
          <Text size="sm" c="dimmed" fw={500}>
            {label}
          </Text>
        ) : (
          <OptionPill color={color} label={label} />
        )}
        <Text size="xs" c="dimmed" data-testid="board-column-count">
          {rows.length}
        </Text>
      </Group>
      <Stack gap="xs">
        {rows.map((row) => (
          <BoardCard
            key={row.row.id}
            row={row}
            databaseId={databaseId}
            cardProperties={cardProperties}
            spaceSlug={spaceSlug}
          />
        ))}
        <Button
          variant="subtle"
          size="xs"
          color="gray"
          onClick={onCreate}
        >
          {t("+ New")}
        </Button>
      </Stack>
    </Box>
  );
}

export default BoardColumn;
