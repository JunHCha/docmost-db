import { useState } from "react";
import {
  ActionIcon,
  Box,
  Center,
  Group,
  Loader,
  Modal,
  ScrollArea,
  Stack,
  Text,
  TextInput,
  UnstyledButton,
} from "@mantine/core";
import { IconDatabase, IconSearch, IconX } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import {
  useListDatabasesQuery,
  useDatabaseViewsQuery,
} from "@/features/database/queries/database-query.ts";
import { IDatabaseListItem, IDatabaseView } from "@/features/database/types/database.types.ts";

// ---------------------------------------------------------------------------
// Step 2: view picker — shown after a database is chosen
// ---------------------------------------------------------------------------

interface ViewPickerProps {
  database: IDatabaseListItem;
  onSelect: (databaseId: string, viewId: string) => void;
  onBack: () => void;
}

function ViewPicker({ database, onSelect, onBack }: ViewPickerProps) {
  const { t } = useTranslation();
  const viewsQuery = useDatabaseViewsQuery(database.id);
  const views = viewsQuery.data ?? [];
  const defaultView = views.find((v) => v.isDefault) ?? views[0];

  if (viewsQuery.isLoading) {
    return (
      <Center py="xl">
        <Loader size="sm" />
      </Center>
    );
  }

  if (viewsQuery.isError || views.length === 0) {
    return (
      <Stack p="md" gap="xs">
        <Text c="dimmed" size="sm">
          {t("No views found")}
        </Text>
        <UnstyledButton onClick={onBack} style={{ fontSize: "var(--mantine-font-size-sm)", color: "var(--mantine-color-blue-5)" }}>
          ← {t("Back")}
        </UnstyledButton>
      </Stack>
    );
  }

  return (
    <Stack gap="xs">
      <Group gap="xs" px="sm" pt="sm">
        <UnstyledButton onClick={onBack} style={{ fontSize: "var(--mantine-font-size-sm)", color: "var(--mantine-color-blue-5)" }}>
          ← {t("Back")}
        </UnstyledButton>
        <Text size="sm" fw={600} c="dimmed">
          {database.title ?? t("Untitled")}
        </Text>
      </Group>
      <ScrollArea.Autosize mah={280}>
        <Stack gap={0} px="xs" pb="xs">
          {views.map((view: IDatabaseView) => (
            <UnstyledButton
              key={view.id}
              onClick={() => onSelect(database.id, view.id)}
              p="sm"
              style={{
                borderRadius: "var(--mantine-radius-sm)",
                fontSize: "var(--mantine-font-size-sm)",
              }}
              data-testid={`view-option-${view.id}`}
            >
              <Group gap="xs">
                <Text size="sm">{view.name}</Text>
                {view.id === defaultView?.id && (
                  <Text size="xs" c="dimmed">
                    ({t("default")})
                  </Text>
                )}
              </Group>
            </UnstyledButton>
          ))}
        </Stack>
      </ScrollArea.Autosize>
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// Step 1: database list picker
// ---------------------------------------------------------------------------

interface DatabaseListProps {
  spaceId: string;
  onSelect: (database: IDatabaseListItem) => void;
}

function DatabaseList({ spaceId, onSelect }: DatabaseListProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const dbQuery = useListDatabasesQuery(spaceId);
  const databases = dbQuery.data ?? [];

  const filtered = databases.filter((db) =>
    (db.title ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  if (dbQuery.isLoading) {
    return (
      <Center py="xl">
        <Loader size="sm" />
      </Center>
    );
  }

  return (
    <Stack gap="xs">
      <Box px="sm" pt="sm">
        <TextInput
          leftSection={<IconSearch size={14} />}
          placeholder={t("Search databases")}
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          size="sm"
          autoFocus
          data-testid="database-search"
        />
      </Box>
      {filtered.length === 0 ? (
        <Center py="lg">
          <Text c="dimmed" size="sm">
            {t("No databases found")}
          </Text>
        </Center>
      ) : (
        <ScrollArea.Autosize mah={280}>
          <Stack gap={0} px="xs" pb="xs">
            {filtered.map((db) => (
              <UnstyledButton
                key={db.id}
                onClick={() => onSelect(db)}
                p="sm"
                style={{
                  borderRadius: "var(--mantine-radius-sm)",
                  fontSize: "var(--mantine-font-size-sm)",
                }}
                data-testid={`database-option-${db.id}`}
              >
                <Group gap="xs">
                  <IconDatabase size={14} />
                  <Text size="sm">{db.title ?? t("Untitled")}</Text>
                </Group>
              </UnstyledButton>
            ))}
          </Stack>
        </ScrollArea.Autosize>
      )}
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// Public modal component
// ---------------------------------------------------------------------------

export interface DatabasePickerModalProps {
  opened: boolean;
  // spaceId of the host document — used to scope the database list.
  spaceId: string;
  onClose: () => void;
  onSelect: (databaseId: string, viewId: string) => void;
}

export function DatabasePickerModal({
  opened,
  spaceId,
  onClose,
  onSelect,
}: DatabasePickerModalProps) {
  const { t } = useTranslation();
  const [selectedDb, setSelectedDb] = useState<IDatabaseListItem | null>(null);

  function handleClose() {
    setSelectedDb(null);
    onClose();
  }

  function handleDbSelect(db: IDatabaseListItem) {
    setSelectedDb(db);
  }

  function handleViewSelect(databaseId: string, viewId: string) {
    onSelect(databaseId, viewId);
    setSelectedDb(null);
  }

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={
        <Text fw={600} size="sm">
          {selectedDb ? t("Select a view") : t("Select a database")}
        </Text>
      }
      size="sm"
      padding="xs"
      withCloseButton
      data-testid="database-picker-modal"
    >
      {selectedDb ? (
        <ViewPicker
          database={selectedDb}
          onSelect={handleViewSelect}
          onBack={() => setSelectedDb(null)}
        />
      ) : (
        <DatabaseList spaceId={spaceId} onSelect={handleDbSelect} />
      )}
    </Modal>
  );
}

export default DatabasePickerModal;
