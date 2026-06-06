import { useMemo, useState } from "react";
import {
  Button,
  Group,
  Modal,
  ScrollArea,
  Stack,
  Text,
  TextInput,
  UnstyledButton,
} from "@mantine/core";
import { IconArrowLeft, IconDatabase } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import {
  useDatabaseViewsQuery,
  useListDatabasesQuery,
} from "@/features/database/queries/database-query.ts";

interface DatabasePickerModalProps {
  opened: boolean;
  spaceId: string;
  onClose: () => void;
  onConfirm: (selection: { databaseId: string; viewId: string }) => void;
}

// Two-step picker: (1) choose a database in the host space, (2) choose one of
// its views. The default view is preselected so a confirm right after picking a
// database is the "insert default view" fast path.
export function DatabasePickerModal({
  opened,
  spaceId,
  onClose,
  onConfirm,
}: DatabasePickerModalProps) {
  const { t } = useTranslation();
  const [databaseId, setDatabaseId] = useState<string | null>(null);
  const [viewId, setViewId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const { data: databases } = useListDatabasesQuery(spaceId);
  const { data: views } = useDatabaseViewsQuery(databaseId ?? "");

  const filteredDatabases = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = databases ?? [];
    if (!term) return list;
    return list.filter((db) => (db.title ?? "").toLowerCase().includes(term));
  }, [databases, search]);

  function reset() {
    setDatabaseId(null);
    setViewId(null);
    setSearch("");
  }

  function handleClose() {
    reset();
    onClose();
  }

  function chooseDatabase(id: string) {
    setDatabaseId(id);
    setViewId(null);
  }

  // Effective view: explicit pick, else the default view, else the first one.
  const effectiveViewId = useMemo(() => {
    if (viewId) return viewId;
    const list = views ?? [];
    if (list.length === 0) return null;
    return (list.find((v) => v.isDefault) ?? list[0]).id;
  }, [viewId, views]);

  function confirm() {
    if (!databaseId || !effectiveViewId) return;
    onConfirm({ databaseId, viewId: effectiveViewId });
    reset();
  }

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={t("Insert database view")}
      size="md"
    >
      {!databaseId ? (
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
      ) : (
        <Stack gap="xs">
          <Group gap="xs">
            <Button
              variant="subtle"
              size="compact-sm"
              leftSection={<IconArrowLeft size={14} />}
              onClick={() => setDatabaseId(null)}
            >
              {t("Back")}
            </Button>
            <Text size="sm" c="dimmed">
              {t("Choose a view")}
            </Text>
          </Group>
          <ScrollArea.Autosize mah={280}>
            <Stack gap={2}>
              {(views ?? []).map((view) => (
                <UnstyledButton
                  key={view.id}
                  onClick={() => setViewId(view.id)}
                  p="xs"
                  style={{
                    borderRadius: 4,
                    background:
                      view.id === effectiveViewId
                        ? "var(--mantine-color-blue-light)"
                        : undefined,
                  }}
                >
                  <Group gap="xs" justify="space-between" wrap="nowrap">
                    <Text size="sm" truncate>
                      {view.name}
                    </Text>
                    {view.isDefault && (
                      <Text size="xs" c="dimmed">
                        {t("Default")}
                      </Text>
                    )}
                  </Group>
                </UnstyledButton>
              ))}
            </Stack>
          </ScrollArea.Autosize>
          <Group justify="flex-end" mt="sm">
            <Button variant="default" onClick={handleClose}>
              {t("Cancel")}
            </Button>
            <Button onClick={confirm} disabled={!effectiveViewId}>
              {t("Insert")}
            </Button>
          </Group>
        </Stack>
      )}
    </Modal>
  );
}

export default DatabasePickerModal;
