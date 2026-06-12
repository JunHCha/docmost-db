import { useMemo, useState } from "react";
import {
  Group,
  Modal,
  ScrollArea,
  Stack,
  Text,
  TextInput,
  UnstyledButton,
} from "@mantine/core";
import { IconDatabase } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { useListDatabasesQuery } from "@/features/database/queries/database-query.ts";

interface DatabasePickerModalProps {
  opened: boolean;
  spaceId: string;
  onClose: () => void;
  onConfirm: (selection: { databaseId: string }) => void;
}

// Single-step picker: choose a database in the host space and it is embedded
// immediately. There is no per-view choice — embedding copies every shared view
// of the source database into the embed's own scope (server seeds them on first
// load, issue #66), so the embed starts with the full set of views.
export function DatabasePickerModal({
  opened,
  spaceId,
  onClose,
  onConfirm,
}: DatabasePickerModalProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");

  const { data: databases } = useListDatabasesQuery(spaceId);

  const filteredDatabases = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = databases ?? [];
    if (!term) return list;
    return list.filter((db) => (db.title ?? "").toLowerCase().includes(term));
  }, [databases, search]);

  function handleClose() {
    setSearch("");
    onClose();
  }

  function chooseDatabase(id: string) {
    onConfirm({ databaseId: id });
    setSearch("");
  }

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={t("Insert database view")}
      size="md"
    >
      <Stack gap="xs">
        <TextInput
          placeholder={t("Search databases")}
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          data-autofocus
        />
        <ScrollArea.Autosize mah={320}>
          <Stack gap={2}>
            {filteredDatabases.map((db) => (
              <UnstyledButton
                key={db.id}
                onClick={() => chooseDatabase(db.id)}
                p="xs"
              >
                <Group gap="xs" wrap="nowrap">
                  <IconDatabase size={16} />
                  <Text size="sm" truncate>
                    {db.title || t("Untitled")}
                  </Text>
                </Group>
              </UnstyledButton>
            ))}
            {filteredDatabases.length === 0 && (
              <Text size="sm" c="dimmed" p="xs">
                {t("No databases found")}
              </Text>
            )}
          </Stack>
        </ScrollArea.Autosize>
      </Stack>
    </Modal>
  );
}

export default DatabasePickerModal;
