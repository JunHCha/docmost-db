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
    <Paper withBorder p="xs" radius="md">
      <Group justify="space-between" align="center">
        <Text size="sm" fw={500}>
          {selectedIds.size} {t("selected")}
        </Text>
        <Group gap="xs">
          <Button
            variant="light"
            color="red"
            size="xs"
            leftSection={<IconTrash size={16} />}
            aria-label={t("Delete selected rows")}
            onClick={handleDelete}
          >
            {t("Delete")}
          </Button>
          <Button
            variant="subtle"
            size="xs"
            leftSection={<IconX size={16} />}
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
