import "@/features/editor/styles/index.css";
import { ReactNode, useState } from "react";
import {
  ActionIcon,
  Button,
  Checkbox,
  Group,
  NumberInput,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { IconX } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { useEditor, EditorContent } from "@tiptap/react";
import { templateExtensions } from "@/features/editor/extensions/extensions";
import { EditorBubbleMenu } from "@/features/editor/components/bubble-menu/bubble-menu";
import { EditorLinkMenu } from "@/features/editor/components/link/link-menu";
import EmojiPicker from "@/components/ui/emoji-picker";
import { PropertyTypeIcon } from "@/features/database/components/property/property-type-icon";
import {
  IDatabaseProperty,
  IDatabaseTemplate,
  IPropertyValue,
} from "@/features/database/types/database.types.ts";
import {
  useCreateTemplateMutation,
  useUpdateTemplateMutation,
} from "@/features/database/queries/database-query.ts";
import classes from "./template-row-editor.module.css";

interface TemplateRowEditorProps {
  databaseId: string;
  properties: IDatabaseProperty[];
  // Template being edited, or null when creating a new one.
  template: IDatabaseTemplate | null;
  // Called after a successful save or when the user dismisses the editor.
  onClose: () => void;
  // Host-supplied header controls (host switch / close). Falls back to a plain
  // close button when omitted.
  headerControls?: ReactNode;
}

// A collab-free editor for a database row template that mirrors the page edit
// UI (big title + icon, Notion-style property presets, rich body) without the
// Hocuspocus/pageId coupling of FullEditor (#102). The page chrome is replicated
// here rather than reused so templates — which have no backing page — can edit a
// rich body via templateExtensions. An accent border + "Editing template" badge
// mark it apart from a real page in every host (modal/aside/full page).
export function TemplateRowEditor({
  databaseId,
  properties,
  template,
  onClose,
  headerControls,
}: TemplateRowEditorProps) {
  const { t } = useTranslation();
  const createTemplate = useCreateTemplateMutation(databaseId);
  const updateTemplate = useUpdateTemplateMutation(databaseId);

  const [name, setName] = useState(template?.name ?? "");
  const [icon, setIcon] = useState<string | null>(template?.icon ?? null);
  const [propertyValues, setPropertyValues] = useState<
    Record<string, IPropertyValue>
  >(template?.propertyValues ?? {});

  const editor = useEditor({
    extensions: templateExtensions,
    content: template?.content ?? "",
    editorProps: {
      handleDOMEvents: {
        keydown: (_view, event) => {
          // Let the slash-command popup own arrow/enter navigation when open.
          if (["ArrowUp", "ArrowDown", "Enter"].includes(event.key)) {
            if (document.querySelector("#slash-command")) return true;
          }
        },
      },
    },
  });

  function setValue(propertyId: string, next: IPropertyValue | undefined) {
    setPropertyValues((prev) => {
      const copy = { ...prev };
      if (next === undefined) delete copy[propertyId];
      else copy[propertyId] = next;
      return copy;
    });
  }

  function save() {
    const json = editor?.getJSON();
    // Treat an empty doc (single empty paragraph) as no content.
    const content =
      json && JSON.stringify(json) !== EMPTY_DOC ? json : undefined;
    const common = {
      name: name.trim() || t("Untitled template"),
      icon: icon ?? undefined,
      propertyValues,
      content,
    };
    if (template) {
      updateTemplate.mutate({ templateId: template.id, ...common });
    } else {
      createTemplate.mutate({ databaseId, ...common });
    }
    onClose();
  }

  return (
    <div className={classes.accent}>
      <Group justify="space-between" className={classes.badgeBar}>
        <Group gap={6}>
          <PropertyTypeIcon type="text" size={14} />
          <Text size="xs" fw={500} className={classes.badgeText}>
            {t("Editing template")}
          </Text>
        </Group>
        {headerControls ?? (
          <ActionIcon
            variant="subtle"
            color="gray"
            size="sm"
            aria-label={t("Close")}
            onClick={onClose}
          >
            <IconX size={16} />
          </ActionIcon>
        )}
      </Group>

      <div className={classes.body}>
        <div className={classes.titleArea}>
          <EmojiPicker
            icon={<span className={classes.emojiIcon}>{icon ?? "🗒️"}</span>}
            readOnly={false}
            onEmojiSelect={(emoji: { native: string }) => setIcon(emoji.native)}
            removeEmojiAction={() => setIcon(null)}
            actionIconProps={{ size: "2.5rem", variant: "transparent" }}
          />
          <input
            className={classes.titleInput}
            placeholder={t("Untitled template")}
            aria-label={t("Template name")}
            autoFocus
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                editor?.commands.focus("start");
              }
            }}
          />
        </div>

        {properties.length > 0 && (
          <Stack gap={2} className={classes.presets}>
            {properties.map((property) => (
              <Group key={property.id} wrap="nowrap" gap="md" align="center">
                <Group gap={6} wrap="nowrap" w={140} style={{ flexShrink: 0 }}>
                  <PropertyTypeIcon type={property.type} />
                  <Text size="sm" c="dimmed" truncate>
                    {property.name}
                  </Text>
                </Group>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <PresetValueInput
                    property={property}
                    value={propertyValues[property.id]}
                    onChange={(next) => setValue(property.id, next)}
                  />
                </div>
              </Group>
            ))}
          </Stack>
        )}

        <div className={classes.editorBody}>
          <EditorContent editor={editor} />
          {editor && (
            <>
              <EditorBubbleMenu editor={editor} templateMode />
              <EditorLinkMenu editor={editor} />
            </>
          )}
        </div>

        <Group justify="flex-end" className={classes.footer}>
          <Button variant="default" onClick={onClose}>
            {t("Cancel")}
          </Button>
          <Button onClick={save}>{t("Save")}</Button>
        </Group>
      </div>
    </div>
  );
}

const EMPTY_DOC = JSON.stringify({
  type: "doc",
  content: [{ type: "paragraph" }],
});

// A per-type preset value editor (no own label — the labelled row supplies it).
// text/number/checkbox cover the common presets; other types fall back to a
// best-effort string the server accepts (mirrors the prior modal behaviour).
function PresetValueInput({
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
        aria-label={property.name}
        variant="unstyled"
        value={typeof raw === "number" ? raw : ""}
        onChange={(v) =>
          onChange(v === "" ? undefined : { type: "number", value: Number(v) })
        }
      />
    );
  }

  return (
    <TextInput
      aria-label={property.name}
      variant="unstyled"
      placeholder={t("No preset")}
      value={typeof raw === "string" ? raw : ""}
      onChange={(e) => {
        const next = e.currentTarget.value;
        onChange(next ? { type: property.type, value: next } : undefined);
      }}
    />
  );
}

export default TemplateRowEditor;
