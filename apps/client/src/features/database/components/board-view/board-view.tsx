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
//
// multi_select limitation (intentional, #13): a drop means "add the target
// option" only — it never removes the option from the source column. Removing a
// multi_select option from its original column is out of scope for this view;
// users unassign directly in the card's multi_select cell instead.
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
    // Add-only: keep the existing options and append the target. The source
    // column is left untouched on purpose (see header note above).
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

  // Optimistically patch the rows cache so the card shows in the target column
  // immediately, then fire the real set-value mutation; its onError invalidates
  // the rows prefix and rolls the optimistic patch back. Shared by card drops
  // and new-card creation so both follow the same optimistic path.
  function setGroupValueOptimistic(
    rowId: string,
    groupProperty: IDatabaseProperty,
    value: NonNullable<IDatabasePropertyValue["value"]>,
  ) {
    patchRowValue(queryClient, databaseId, {
      id: `optimistic-${rowId}-${groupProperty.id}`,
      pageId: rowId,
      propertyId: groupProperty.id,
      value,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    setValue.mutate({ pageId: rowId, propertyId: groupProperty.id, value });
  }

  // Move a card to a column. Clearing for the unassigned column; otherwise the
  // shared optimistic set-value path above.
  function moveCard(rowId: string, optionId: string | null) {
    if (!groupBy) return;
    const row = rows.find((r) => r.row.id === rowId);
    const value = nextValueFor(groupBy, row, optionId);
    if (value === null) {
      removeRowValue(queryClient, databaseId, rowId, groupBy.id);
      clearValue.mutate({ pageId: rowId, propertyId: groupBy.id });
      return;
    }
    setGroupValueOptimistic(rowId, groupBy, value);
  }

  function createInColumn(optionId: string | null) {
    if (!groupBy) return;
    createRow.mutate(
      { databaseId },
      {
        onSuccess: (page) => {
          // Unassigned column: leave the group value unset (existing behavior).
          if (optionId === null) return;
          const value = nextValueFor(groupBy, undefined, optionId);
          // Reuse the same optimistic patch as card drops so the new card lands
          // in its column immediately; a failed set-value invalidates and rolls
          // back, dropping the card to the unassigned column rather than leaving
          // it stranded with no optimistic feedback.
          if (value) setGroupValueOptimistic(page.id, groupBy, value);
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
