import { useState } from "react";
import {
  ActionIcon,
  Button,
  Divider,
  Group,
  Popover,
  Stack,
  Text,
  Tooltip,
  UnstyledButton,
} from "@mantine/core";
import {
  IconPlus,
  IconTemplate,
  IconTrash,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import {
  useDatabaseTemplatesQuery,
  useDeleteTemplateMutation,
} from "@/features/database/queries/database-query.ts";
import { useTemplatePeek } from "./template-peek/use-template-peek";

interface TemplateManagerMenuProps {
  databaseId: string;
}

// Row-creation templates entry point (#91, #102): the toolbar button opens a
// dropdown listing the database's templates; picking one (or "New template")
// opens the rich page-like editor in the template peek (modal / aside / page).
// List = dropdown, editing = its own host surface (Notion-style).
export function TemplateManagerMenu({ databaseId }: TemplateManagerMenuProps) {
  const { t } = useTranslation();
  const templates = useDatabaseTemplatesQuery(databaseId).data ?? [];
  const deleteTemplate = useDeleteTemplateMutation(databaseId);
  const { open } = useTemplatePeek();

  const [listOpen, setListOpen] = useState(false);

  function edit(templateId: string | null) {
    setListOpen(false);
    open(databaseId, templateId, "modal");
  }

  return (
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
              <Group
                key={template.id}
                justify="space-between"
                wrap="nowrap"
                gap="xs"
              >
                <UnstyledButton
                  style={{ flex: 1, minWidth: 0 }}
                  aria-label={`${t("Edit template")} ${template.name}`}
                  onClick={() => edit(template.id)}
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
            onClick={() => edit(null)}
          >
            {t("New template")}
          </Button>
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}

export default TemplateManagerMenu;
