import { useMemo } from "react";
import { Box, Group, Stack, Text } from "@mantine/core";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  IDatabaseProperty,
  IDatabasePropertyValue,
  IDatabaseRow,
  IDatabaseView,
} from "@/features/database/types/database.types.ts";
import {
  useClearValueMutation,
  useCreateRowMutation,
  useSetValueMutation,
  useUpdateViewMutation,
} from "@/features/database/queries/database-query.ts";
import {
  patchRowValue,
  removeRowValue,
} from "@/features/database/queries/database-cache.ts";
import { groupRows } from "./group-rows";
import { BoardColumn } from "./board-column";
import { BoardSettingsMenu } from "./board-settings-menu";

interface BoardViewProps {
  databaseId: string;
  spaceId: string;
  properties: IDatabaseProperty[];
  rows: IDatabaseRow[];
  activeView: IDatabaseView;
  spaceSlug?: string;
}

// Builds the value that drops the source row into the target option. multi_select
// adds the option to the row's current array (no-op if already there); select
// replaces. Returns null for the unassigned column (the caller clears instead).
function nextValueFor(
  property: IDatabaseProperty,
  row: IDatabaseRow | undefined,
  optionId: string | null,
): IDatabasePropertyValue["value"] | null {
  if (optionId === null) return null;
  if (property.type === "multi_select") {
    const current = row?.values.find((v) => v.propertyId === property.id)?.value
      ?.value;
    const ids: string[] = Array.isArray(current) ? current : [];
    const next = ids.includes(optionId) ? ids : [...ids, optionId];
    return { type: "multi_select", value: next };
  }
  return { type: "select", value: optionId };
}

export function BoardView({
  databaseId,
  properties,
  rows,
  activeView,
  spaceSlug,
}: BoardViewProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const setValue = useSetValueMutation(databaseId);
  const clearValue = useClearValueMutation(databaseId);
  const createRow = useCreateRowMutation(databaseId);
  const updateView = useUpdateViewMutation(databaseId);

  const groupByPropertyId = activeView.config.groupByPropertyId;
  const cardPropertyIds = activeView.config.cardProperties ?? [];
  const groupBy = useMemo(
    () => properties.find((p) => p.id === groupByPropertyId),
    [properties, groupByPropertyId],
  );

  const cardProperties = useMemo(
    () =>
      cardPropertyIds
        .map((id) => properties.find((p) => p.id === id))
        .filter((p): p is IDatabaseProperty => !!p && p.id !== groupByPropertyId),
    [cardPropertyIds, properties, groupByPropertyId],
  );

  const buckets = useMemo(
    () => (groupBy ? groupRows(rows, groupBy) : null),
    [groupBy, rows],
  );

  function commitGroupBy(propertyId: string | null) {
    updateView.mutate({
      viewId: activeView.id,
      config: { ...activeView.config, groupByPropertyId: propertyId ?? undefined },
    });
  }

  function commitCardProperties(next: string[]) {
    updateView.mutate({
      viewId: activeView.id,
      config: { ...activeView.config, cardProperties: next },
    });
  }

  // Move a card to a column. We optimistically patch the rows cache so the card
  // jumps immediately, then fire the real mutation; its onError invalidates the
  // rows prefix and rolls the optimistic patch back.
  function moveCard(rowId: string, optionId: string | null) {
    if (!groupBy) return;
    const row = rows.find((r) => r.row.id === rowId);
    const value = nextValueFor(groupBy, row, optionId);
    if (value === null) {
      removeRowValue(queryClient, databaseId, rowId, groupBy.id);
      clearValue.mutate({ pageId: rowId, propertyId: groupBy.id });
      return;
    }
    patchRowValue(queryClient, databaseId, {
      id: `optimistic-${rowId}-${groupBy.id}`,
      pageId: rowId,
      propertyId: groupBy.id,
      value,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    setValue.mutate({ pageId: rowId, propertyId: groupBy.id, value });
  }

  function createInColumn(optionId: string | null) {
    if (!groupBy) return;
    createRow.mutate(
      { databaseId },
      {
        onSuccess: (page) => {
          if (optionId === null) return;
          const value = nextValueFor(groupBy, undefined, optionId);
          if (value) {
            setValue.mutate({
              pageId: page.id,
              propertyId: groupBy.id,
              value,
            });
          }
        },
      },
    );
  }

  return (
    <Stack gap="sm" data-testid="board-view">
      <BoardSettingsMenu
        properties={properties}
        groupByPropertyId={groupByPropertyId}
        cardProperties={cardPropertyIds}
        onChangeGroupBy={commitGroupBy}
        onToggleCardProperty={commitCardProperties}
      />
      {!groupBy || !buckets ? (
        <Box p="xl">
          <Text c="dimmed">{t("Select a property to group by")}</Text>
        </Box>
      ) : (
        <Group align="flex-start" wrap="nowrap" style={{ overflowX: "auto" }}>
          {buckets.groups.map((group) => (
            <BoardColumn
              key={group.option.id}
              optionId={group.option.id}
              label={group.option.label}
              color={group.option.color}
              rows={group.rows}
              databaseId={databaseId}
              cardProperties={cardProperties}
              spaceSlug={spaceSlug}
              onDropCard={(rowId) => moveCard(rowId, group.option.id)}
              onCreate={() => createInColumn(group.option.id)}
            />
          ))}
          <BoardColumn
            optionId={null}
            label={`${t("No")} ${groupBy.name}`}
            rows={buckets.unassigned}
            databaseId={databaseId}
            cardProperties={cardProperties}
            spaceSlug={spaceSlug}
            onDropCard={(rowId) => moveCard(rowId, null)}
            onCreate={() => createInColumn(null)}
          />
        </Group>
      )}
    </Stack>
  );
}

export default BoardView;
