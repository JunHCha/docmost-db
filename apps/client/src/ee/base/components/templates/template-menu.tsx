import { useCallback, useState } from "react";
import { ActionIcon, Loader, Menu, Text, Tooltip } from "@mantine/core";
import {
  IconDots,
  IconPencil,
  IconPlus,
  IconTemplate,
  IconTrash,
} from "@tabler/icons-react";
import { modals } from "@mantine/modals";
import { useTranslation } from "react-i18next";
import { IBase, IBaseTemplate } from "@/ee/base/types/base.types";
import {
  useBaseTemplatesQuery,
  useDeleteTemplateMutation,
} from "@/ee/base/queries/base-template-query";
import { useCreateRowMutation } from "@/ee/base/queries/base-row-query";
import { useBaseEditable } from "@/ee/base/context/base-editable";
import { TemplateEditorModal } from "./template-editor-modal";

type TemplateItemActionsProps = {
  onEdit: () => void;
  onDelete: () => void;
};

// Rendered inside the outer Menu's dropdown: withinPortal={false} keeps the
// sub-dropdown inside the outer dropdown's DOM so its clicks don't count as
// outside-clicks that would close (and unmount) the parent menu.
function TemplateItemActions({ onEdit, onDelete }: TemplateItemActionsProps) {
  const { t } = useTranslation();
  return (
    <Menu position="bottom-end" shadow="md" withinPortal={false}>
      <Menu.Target>
        <ActionIcon
          variant="subtle"
          size="xs"
          color="gray"
          onClick={(e) => e.stopPropagation()}
          aria-label={t("Template options")}
        >
          <IconDots size={14} />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item
          leftSection={<IconPencil size={14} />}
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
        >
          {t("Edit")}
        </Menu.Item>
        <Menu.Item
          color="red"
          leftSection={<IconTrash size={14} />}
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          {t("Delete")}
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}

type TemplateMenuProps = {
  base: IBase;
  pageId: string;
};

export function TemplateMenu({ base, pageId }: TemplateMenuProps) {
  const { t } = useTranslation();
  const editable = useBaseEditable();
  const { data: templates, isLoading } = useBaseTemplatesQuery(pageId);
  const createRowMutation = useCreateRowMutation();
  const deleteTemplateMutation = useDeleteTemplateMutation();

  const [editorOpened, setEditorOpened] = useState(false);
  const [editingTemplate, setEditingTemplate] =
    useState<IBaseTemplate | null>(null);

  const handleUseTemplate = useCallback(
    (template: IBaseTemplate) => {
      createRowMutation.mutate({ pageId, templateId: template.id });
    },
    [createRowMutation, pageId],
  );

  const openCreate = useCallback(() => {
    setEditingTemplate(null);
    setEditorOpened(true);
  }, []);

  const openEdit = useCallback((template: IBaseTemplate) => {
    setEditingTemplate(template);
    setEditorOpened(true);
  }, []);

  const handleDelete = useCallback(
    (template: IBaseTemplate) => {
      modals.openConfirmModal({
        title: t('Delete template "{{name}}"?', { name: template.name }),
        centered: true,
        children: <Text size="sm">{t("This action cannot be undone.")}</Text>,
        labels: { confirm: t("Delete"), cancel: t("Cancel") },
        confirmProps: { color: "red" },
        onConfirm: () =>
          deleteTemplateMutation.mutate({ templateId: template.id, pageId }),
      });
    },
    [deleteTemplateMutation, pageId, t],
  );

  const items = templates ?? [];

  // Read-only viewers can only apply templates; with none to apply the
  // menu would be empty, so hide it entirely.
  if (!editable && items.length === 0) return null;

  return (
    <>
      <Menu position="bottom-end" width={240} shadow="md" withinPortal>
        <Menu.Target>
          <Tooltip label={t("Templates")}>
            <ActionIcon variant="subtle" size="sm" color="gray">
              <IconTemplate size={16} />
            </ActionIcon>
          </Tooltip>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Label>{t("Templates")}</Menu.Label>
          {items.map((template) => (
            <Menu.Item
              key={template.id}
              component="div"
              leftSection={
                template.icon ? (
                  <Text component="span" size="sm">
                    {template.icon}
                  </Text>
                ) : (
                  <IconTemplate size={14} />
                )
              }
              rightSection={
                editable ? (
                  <TemplateItemActions
                    onEdit={() => openEdit(template)}
                    onDelete={() => handleDelete(template)}
                  />
                ) : undefined
              }
              onClick={() => handleUseTemplate(template)}
            >
              <Text size="sm" truncate>
                {template.name}
              </Text>
            </Menu.Item>
          ))}
          {isLoading && items.length === 0 && (
            <Text size="xs" c="dimmed" px="sm" py={6}>
              <Loader size={12} mr={6} />
              {t("Loading...")}
            </Text>
          )}
          {!isLoading && items.length === 0 && (
            <Text size="xs" c="dimmed" px="sm" py={6}>
              {t("No templates yet")}
            </Text>
          )}
          {editable && (
            <>
              <Menu.Divider />
              <Menu.Item
                leftSection={<IconPlus size={14} />}
                onClick={openCreate}
              >
                {t("New template")}
              </Menu.Item>
            </>
          )}
        </Menu.Dropdown>
      </Menu>

      <TemplateEditorModal
        opened={editorOpened}
        onClose={() => setEditorOpened(false)}
        base={base}
        pageId={pageId}
        template={editingTemplate}
      />
    </>
  );
}
