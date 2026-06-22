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
} from "@/features/database/queries/database-query.ts";
import {
  patchRowValue,
  removeRowValue,
} from "@/features/database/queries/database-cache.ts";
import { sanitizeFilters } from "@/features/database/filters/sanitize.ts";
import { deriveInitialValuesFromFilters } from "@/features/database/filters/initial-values.ts";
import { resolveColumns } from "../table-view/view-columns";
import { groupRows } from "./group-rows";
import { BoardColumn } from "./board-column";

interface BoardViewProps {
  databaseId: string;
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

  const groupByPropertyId = activeView.config.groupByPropertyId;
  // Only select/multi_select can be grouped. Guard the render path against a
  // stale view or hand-injected config that points groupBy at another type —
  // fall back to the empty "pick a property" state instead of grouping.
  const groupBy = useMemo(() => {
    const prop = properties.find((p) => p.id === groupByPropertyId);
    if (!prop || (prop.type !== "select" && prop.type !== "multi_select")) {
      return undefined;
    }
    return prop;
  }, [properties, groupByPropertyId]);

  // Cards show the view's visible columns (managed via the toolbar's Properties
  // menu), minus the group-by property — the column already encodes that value.
  const cardProperties = useMemo(
    () =>
      resolveColumns(properties, activeView.config.columns)
        .map((c) => c.property)
        .filter((p) => p.id !== groupByPropertyId),
    [properties, activeView.config.columns, groupByPropertyId],
  );

  const buckets = useMemo(
    () => (groupBy ? groupRows(rows, groupBy) : null),
    [groupBy, rows],
  );

  // Seed new cards with the active filters' values so they survive this view
  // (issue #103). The group-by property is excluded — createInColumn's onSuccess
  // setValue path owns that one, and the column the card lands in pins it.
  const filterInitialValues = useMemo(() => {
    const derived = deriveInitialValuesFromFilters(
      sanitizeFilters(activeView.config.filters ?? []),
      properties,
    );
    if (groupByPropertyId) delete derived[groupByPropertyId];
    return derived;
  }, [activeView.config.filters, properties, groupByPropertyId]);

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
      { databaseId, initialValues: filterInitialValues },
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
