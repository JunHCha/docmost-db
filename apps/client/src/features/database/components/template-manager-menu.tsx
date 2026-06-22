import { lazy, Suspense, useState } from "react";
import {
  ActionIcon,
  Button,
  Center,
  Divider,
  Group,
  Loader,
  Modal,
  Popover,
  Stack,
  Text,
  Tooltip,
  UnstyledButton,
} from "@mantine/core";
import {
  IconPencil,
  IconPlus,
  IconTemplate,
  IconTrash,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { IDatabaseTemplate } from "@/features/database/types/database.types.ts";
import {
  useDatabaseTemplatesQuery,
  useDatabasePropertiesQuery,
  useDeleteTemplateMutation,
} from "@/features/database/queries/database-query.ts";

// Lazy so the heavy tiptap extension graph the editor pulls isn't dragged into
// the toolbar (and thus the whole database view) at import time — it loads only
// when a template is actually opened for editing.
const TemplateRowEditor = lazy(
  () => import("./template-peek/template-row-editor"),
);

interface TemplateManagerMenuProps {
  databaseId: string;
}

// Row-creation templates entry point (#91, #102): the toolbar button opens a
// dropdown listing the database's templates; picking one (or "New template")
// opens the rich page-like editor in a separate modal. List = dropdown, editing
// = its own surface (Notion-style).
export function TemplateManagerMenu({ databaseId }: TemplateManagerMenuProps) {
  const { t } = useTranslation();
  const templates = useDatabaseTemplatesQuery(databaseId).data ?? [];
  const properties = useDatabasePropertiesQuery(databaseId).data ?? [];
  const deleteTemplate = useDeleteTemplateMutation(databaseId);

  const [listOpen, setListOpen] = useState(false);
  // null = closed; { template } = editing (template null => creating new).
  const [editing, setEditing] = useState<{
    template: IDatabaseTemplate | null;
  } | null>(null);

  function openEditor(template: IDatabaseTemplate | null) {
    setListOpen(false);
    setEditing({ template });
  }

  return (
    <>
      <Popover
        opened={listOpen}
        onChange={setListOpen}
        position="bottom-end"
        shadow="md"
        withinPortal
      >
        <Popover.Target>
          <Tooltip label={t("Templates")}>
            <ActionIcon
              variant="subtle"
              color="gray"
              aria-label={t("Templates")}
              onClick={() => setListOpen((o) => !o)}
            >
              <IconTemplate size={16} />
            </ActionIcon>
          </Tooltip>
        </Popover.Target>
        <Popover.Dropdown p={4}>
          <Stack gap={2} miw={240}>
            {templates.length === 0 ? (
              <Text c="dimmed" size="sm" ta="center" py="xs">
                {t("No templates")}
              </Text>
            ) : (
              templates.map((template) => (
                <Group key={template.id} justify="space-between" wrap="nowrap" gap="xs">
                  <UnstyledButton
                    style={{ flex: 1, minWidth: 0 }}
                    aria-label={`${t("Edit template")} ${template.name}`}
                    onClick={() => openEditor(template)}
                  >
                    <Group gap="xs" wrap="nowrap">
                      <Text>{template.icon ?? "🗒️"}</Text>
                      <Text size="sm" truncate>
                        {template.name}
                      </Text>
                    </Group>
                  </UnstyledButton>
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    size="sm"
                    aria-label={`${t("Delete template")} ${template.name}`}
                    onClick={() =>
                      deleteTemplate.mutate({ templateId: template.id })
                    }
                  >
                    <IconTrash size={14} />
                  </ActionIcon>
                </Group>
              ))
            )}
            <Divider my={2} />
            <Button
              variant="subtle"
              size="xs"
              fullWidth
              justify="flex-start"
              leftSection={<IconPlus size={14} />}
              onClick={() => openEditor(null)}
            >
              {t("New template")}
            </Button>
          </Stack>
        </Popover.Dropdown>
      </Popover>

      <Modal
        opened={!!editing}
        onClose={() => setEditing(null)}
        title={null}
        size={760}
        padding={0}
        // Match the editor's accent border radius (radius-lg) sitting flush at
        // the modal edge, so the nested rounded corners agree.
        radius="lg"
        withCloseButton={false}
      >
        {editing && (
          <Suspense
            fallback={
              <Center p="xl">
                <Loader size="sm" />
              </Center>
            }
          >
            <TemplateRowEditor
              databaseId={databaseId}
              properties={properties}
              template={editing.template}
              onClose={() => setEditing(null)}
            />
          </Suspense>
        )}
      </Modal>
    </>
  );
}

export default TemplateManagerMenu;
