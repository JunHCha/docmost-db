import { Button, Group, Paper, Text } from "@mantine/core";
import { IconTrash, IconX } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { useDeleteRowsMutation } from "@/features/database/queries/database-query.ts";

interface SelectionActionBarProps {
  databaseId: string;
  selectedIds: Set<string>;
  onClear: () => void;
}

// Bulk-action bar shown while one or more rows are selected. Delete reuses the
// page soft-delete path via useDeleteRowsMutation (optimistic removeRows) and
// clears the selection once the rows are gone.
export function SelectionActionBar({
  databaseId,
  selectedIds,
  onClear,
}: SelectionActionBarProps) {
  const { t } = useTranslation();
  const deleteRows = useDeleteRowsMutation(databaseId);

  function handleDelete() {
    deleteRows.mutate(
      { databaseId, pageIds: [...selectedIds] },
      { onSuccess: () => onClear() },
    );
  }

  return (
    // Compact bar: tight vertical padding and compact-xs buttons keep the
    // selection header from dominating the view (issue #67).
    <Paper withBorder px="xs" py={4} radius="sm" mb={4}>
      <Group justify="space-between" align="center" wrap="nowrap">
        <Text size="xs" fw={500}>
          {selectedIds.size} {t("selected")}
        </Text>
        <Group gap={4} wrap="nowrap">
          <Button
            variant="light"
            color="red"
            size="compact-xs"
            leftSection={<IconTrash size={14} />}
            aria-label={t("Delete selected rows")}
            onClick={handleDelete}
          >
            {t("Delete")}
          </Button>
          <Button
            variant="subtle"
            size="compact-xs"
            leftSection={<IconX size={14} />}
            aria-label={t("Clear selection")}
            onClick={onClear}
          >
            {t("Clear")}
          </Button>
        </Group>
      </Group>
    </Paper>
  );
}

export default SelectionActionBar;
