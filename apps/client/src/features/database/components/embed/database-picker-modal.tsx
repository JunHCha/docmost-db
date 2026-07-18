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
import { useTranslation } from "react-i18next";
import { useListDatabasesQuery } from "@/features/database/queries/database-query.ts";
import { useRefetchOnOpen } from "@/features/database/hooks/use-refetch-on-open.ts";
import { ListFetchSplash } from "@/features/database/components/common/list-fetch-splash.tsx";
import { PageGlyph } from "@/features/database/components/table-view/cells/page-ref-chip.tsx";
import classes from "./database-picker-modal.module.css";

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

  // Refetch the database list whenever the picker opens so a database renamed
  // (or created/deleted) elsewhere is reflected, instead of the 5-min-stale
  // cache (main.tsx disables refetchOnMount). A splash covers the fetch.
  const { data: databases, refetch, isFetching } = useListDatabasesQuery(spaceId);
  useRefetchOnOpen(opened, refetch);

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
          {isFetching ? (
            <ListFetchSplash label={t("Loading…")} />
          ) : (
          <Stack gap={2}>
            {filteredDatabases.map((db) => (
              <UnstyledButton
                key={db.id}
                onClick={() => chooseDatabase(db.id)}
                className={classes.item}
                p="xs"
              >
                <Group gap="xs" wrap="nowrap">
                  <PageGlyph icon={db.icon} pageType="database" />
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
          )}
        </ScrollArea.Autosize>
      </Stack>
    </Modal>
  );
}

export default DatabasePickerModal;
