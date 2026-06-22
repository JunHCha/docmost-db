import { lazy, Suspense, useState } from "react";
import {
  Modal,
  Stack,
  Group,
  Button,
  Text,
  ActionIcon,
  Center,
  Loader,
} from "@mantine/core";
import { IconTrash, IconPencil } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { IDatabaseTemplate } from "@/features/database/types/database.types.ts";
import {
  useDatabaseTemplatesQuery,
  useDatabasePropertiesQuery,
  useDeleteTemplateMutation,
} from "@/features/database/queries/database-query.ts";

// Lazy so the heavy tiptap extension graph the editor pulls isn't dragged into
// every consumer of this modal (the view toolbar, and thus the whole database
// view) at import time — it loads only when a template is actually opened
// (mirrors relation-peek keeping its heavy body out of the light hook).
const TemplateRowEditor = lazy(
  () => import("./template-peek/template-row-editor"),
);

interface TemplateManagerModalProps {
  opened: boolean;
  databaseId: string;
  onClose: () => void;
}

export function TemplateManagerModal({
  opened,
  databaseId,
  onClose,
}: TemplateManagerModalProps) {
  const { t } = useTranslation();
  const templates = useDatabaseTemplatesQuery(databaseId).data ?? [];
  const properties = useDatabasePropertiesQuery(databaseId).data ?? [];
  const deleteTemplate = useDeleteTemplateMutation(databaseId);

  // null = list view; { template } = editing (template null => creating new).
  const [editing, setEditing] = useState<{
    template: IDatabaseTemplate | null;
  } | null>(null);

  function close() {
    setEditing(null);
    onClose();
  }

  // While editing, the modal hosts the rich page-like TemplateRowEditor (#102):
  // wider, no Mantine header/padding so the editor's own accent chrome owns the
  // surface. The list view keeps the compact titled modal.
  return (
    <Modal
      opened={opened}
      onClose={close}
      title={editing ? null : t("Templates")}
      size={editing ? 760 : "lg"}
      padding={editing ? 0 : undefined}
      // While editing the editor's accent border (radius-lg) sits flush at the
      // modal edge (padding 0), so match the modal corner radius to it — else
      // the two nested rounded rectangles' corners disagree.
      radius={editing ? "lg" : undefined}
      withCloseButton={!editing}
    >
      {editing ? (
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
      ) : (
        <Stack gap="xs">
          {templates.length === 0 ? (
            <Text c="dimmed" ta="center" py="md">
              {t("No templates")}
            </Text>
          ) : (
            templates.map((template) => (
              <Group key={template.id} justify="space-between" wrap="nowrap">
                <Group gap="xs" wrap="nowrap">
                  <Text>{template.icon ?? "🗒️"}</Text>
                  <Text>{template.name}</Text>
                </Group>
                <Group gap={4} wrap="nowrap">
                  <ActionIcon
                    variant="subtle"
                    aria-label={`${t("Edit template")} ${template.name}`}
                    onClick={() => setEditing({ template })}
                  >
                    <IconPencil size={16} />
                  </ActionIcon>
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    aria-label={`${t("Delete template")} ${template.name}`}
                    onClick={() =>
                      deleteTemplate.mutate({ templateId: template.id })
                    }
                  >
                    <IconTrash size={16} />
                  </ActionIcon>
                </Group>
              </Group>
            ))
          )}
          <Button onClick={() => setEditing({ template: null })}>
            {t("New template")}
          </Button>
        </Stack>
      )}
    </Modal>
  );
}

export default TemplateManagerModal;
