import { ReactNode } from "react";
import { Center, Loader, Text } from "@mantine/core";
import { useTranslation } from "react-i18next";
import {
  useDatabaseTemplatesQuery,
  useDatabasePropertiesQuery,
} from "@/features/database/queries/database-query.ts";
import { TemplateRowEditor } from "./template-row-editor";

interface TemplatePeekBodyProps {
  databaseId: string;
  // null => new template.
  templateId: string | null;
  onClose: () => void;
  headerControls?: ReactNode;
}

// Shared editor body for all template hosts (modal / aside / full page). There's
// no single-template fetch endpoint, but the list query already carries each
// template's content, so we pick it from there (no backend change, #102).
export function TemplatePeekBody({
  databaseId,
  templateId,
  onClose,
  headerControls,
}: TemplatePeekBodyProps) {
  const { t } = useTranslation();
  const templatesQuery = useDatabaseTemplatesQuery(databaseId);
  const properties = useDatabasePropertiesQuery(databaseId).data ?? [];

  if (templateId === null) {
    return (
      <TemplateRowEditor
        key="new"
        databaseId={databaseId}
        properties={properties}
        template={null}
        onClose={onClose}
        headerControls={headerControls}
      />
    );
  }

  if (!templatesQuery.data) {
    return (
      <Center p="xl">
        <Loader size="sm" />
      </Center>
    );
  }

  const template =
    templatesQuery.data.find((tpl) => tpl.id === templateId) ?? null;

  if (!template) {
    return (
      <Center p="xl">
        <Text c="dimmed" size="sm">
          {t("Template not found")}
        </Text>
      </Center>
    );
  }

  return (
    <TemplateRowEditor
      key={template.id}
      databaseId={databaseId}
      properties={properties}
      template={template}
      onClose={onClose}
      headerControls={headerControls}
    />
  );
}

export default TemplatePeekBody;
