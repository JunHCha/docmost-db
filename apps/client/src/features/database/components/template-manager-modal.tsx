import { useState } from "react";
import {
  Modal,
  Stack,
  Group,
  Button,
  Text,
  ActionIcon,
  TextInput,
  Textarea,
  NumberInput,
  Checkbox,
  Divider,
} from "@mantine/core";
import { IconTrash, IconPencil, IconArrowLeft } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import EmojiPicker from "@/components/ui/emoji-picker";
import {
  IDatabaseProperty,
  IDatabaseTemplate,
  IPropertyValue,
} from "@/features/database/types/database.types.ts";
import {
  useDatabaseTemplatesQuery,
  useDatabasePropertiesQuery,
  useCreateTemplateMutation,
  useUpdateTemplateMutation,
  useDeleteTemplateMutation,
} from "@/features/database/queries/database-query.ts";

interface TemplateManagerModalProps {
  opened: boolean;
  databaseId: string;
  onClose: () => void;
}

// A simple per-type preset value editor. The full cell editors (select options,
// relations, dates) are deferred (#91): text/number/checkbox cover the common
// presets, and any other type starts empty (the row inherits the property's
// default until the user sets it on the row).
function PropertyValueInput({
  property,
  value,
  onChange,
}: {
  property: IDatabaseProperty;
  value: IPropertyValue | undefined;
  onChange: (next: IPropertyValue | undefined) => void;
}) {
  const { t } = useTranslation();
  const raw = value?.value;

  if (property.type === "checkbox") {
    return (
      <Checkbox
        label={property.name}
        aria-label={property.name}
        checked={raw === true}
        onChange={(e) =>
          onChange(
            e.currentTarget.checked
              ? { type: "checkbox", value: true }
              : undefined,
          )
        }
      />
    );
  }

  if (property.type === "number") {
    return (
      <NumberInput
        label={property.name}
        aria-label={property.name}
        value={typeof raw === "number" ? raw : ""}
        onChange={(v) =>
          onChange(v === "" ? undefined : { type: "number", value: Number(v) })
        }
      />
    );
  }

  // text / url / select / multi_select / relation: a plain text preset. For the
  // typed-but-unsupported editors this stores a best-effort string the server
  // accepts; richer editors can replace this later.
  return (
    <TextInput
      label={property.name}
      aria-label={property.name}
      placeholder={t("No preset")}
      value={typeof raw === "string" ? raw : ""}
      onChange={(e) => {
        const next = e.currentTarget.value;
        onChange(next ? { type: property.type, value: next } : undefined);
      }}
    />
  );
}

interface TemplateFormProps {
  databaseId: string;
  properties: IDatabaseProperty[];
  // Existing template being edited, or null when creating a new one.
  template: IDatabaseTemplate | null;
  onBack: () => void;
}

function TemplateForm({
  databaseId,
  properties,
  template,
  onBack,
}: TemplateFormProps) {
  const { t } = useTranslation();
  const createTemplate = useCreateTemplateMutation(databaseId);
  const updateTemplate = useUpdateTemplateMutation(databaseId);

  const [name, setName] = useState(template?.name ?? "");
  const [icon, setIcon] = useState<string | null>(template?.icon ?? null);
  const [propertyValues, setPropertyValues] = useState<
    Record<string, IPropertyValue>
  >(template?.propertyValues ?? {});
  // Content (prosemirror JSON) editing via the full editor is deferred (#91):
  // FullEditor is bound to a real pageId + collab room, so it can't be embedded
  // for a template that has no page. A plain body placeholder is captured here
  // and stored as a minimal doc; richer editing can replace this later.
  const [body, setBody] = useState(extractBody(template?.content));

  function setValue(propertyId: string, next: IPropertyValue | undefined) {
    setPropertyValues((prev) => {
      const copy = { ...prev };
      if (next === undefined) delete copy[propertyId];
      else copy[propertyId] = next;
      return copy;
    });
  }

  function save() {
    const content = body.trim() ? bodyToDoc(body) : undefined;
    if (template) {
      updateTemplate.mutate({
        templateId: template.id,
        name: name.trim() || t("Untitled template"),
        icon: icon ?? undefined,
        propertyValues,
        content,
      });
    } else {
      createTemplate.mutate({
        databaseId,
        name: name.trim() || t("Untitled template"),
        icon: icon ?? undefined,
        propertyValues,
        content,
      });
    }
    onBack();
  }

  return (
    <Stack gap="sm">
      <Group gap="xs">
        <ActionIcon
          variant="subtle"
          aria-label={t("Back")}
          onClick={onBack}
        >
          <IconArrowLeft size={16} />
        </ActionIcon>
        <EmojiPicker
          icon={<span>{icon ?? "🗒️"}</span>}
          readOnly={false}
          onEmojiSelect={(emoji: { native: string }) => setIcon(emoji.native)}
          removeEmojiAction={() => setIcon(null)}
        />
        <TextInput
          flex={1}
          aria-label={t("Template name")}
          placeholder={t("Template name")}
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
        />
      </Group>

      <Divider label={t("Property presets")} />
      <Stack gap="xs">
        {properties.map((property) => (
          <PropertyValueInput
            key={property.id}
            property={property}
            value={propertyValues[property.id]}
            onChange={(next) => setValue(property.id, next)}
          />
        ))}
      </Stack>

      <Divider label={t("Body")} />
      <Textarea
        aria-label={t("Template body")}
        placeholder={t("Body content applied to new rows")}
        autosize
        minRows={3}
        value={body}
        onChange={(e) => setBody(e.currentTarget.value)}
      />

      <Group justify="flex-end">
        <Button variant="default" onClick={onBack}>
          {t("Cancel")}
        </Button>
        <Button onClick={save}>{t("Save")}</Button>
      </Group>
    </Stack>
  );
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

  return (
    <Modal
      opened={opened}
      onClose={close}
      title={t("Templates")}
      size="lg"
    >
      {editing ? (
        <TemplateForm
          databaseId={databaseId}
          properties={properties}
          template={editing.template}
          onBack={() => setEditing(null)}
        />
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

// Pull plain text out of a stored prosemirror doc for the body placeholder
// editor. Best-effort: concatenates top-level paragraph text.
function extractBody(content: Record<string, unknown> | null | undefined): string {
  if (!content || !Array.isArray((content as { content?: unknown[] }).content)) {
    return "";
  }
  const nodes = (content as { content: unknown[] }).content;
  return nodes
    .map((node) => {
      const inner = (node as { content?: { text?: string }[] }).content;
      if (!Array.isArray(inner)) return "";
      return inner.map((c) => c.text ?? "").join("");
    })
    .join("\n");
}

// Wrap the body placeholder text into a minimal prosemirror doc the server
// stores as the new row's content.
function bodyToDoc(body: string): Record<string, unknown> {
  return {
    type: "doc",
    content: body.split("\n").map((line) => ({
      type: "paragraph",
      content: line ? [{ type: "text", text: line }] : [],
    })),
  };
}

export default TemplateManagerModal;
