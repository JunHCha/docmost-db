import "@/features/editor/styles/index.css";
import { ReactNode, useEffect, useId, useState } from "react";
import {
  ActionIcon,
  Button,
  Group,
  Stack,
  Text,
} from "@mantine/core";
import { IconX } from "@tabler/icons-react";
import clsx from "clsx";
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
  useDatabaseInfoByIdQuery,
  useUpdateTemplateMutation,
} from "@/features/database/queries/database-query.ts";
import { DatabasePickerModal } from "@/features/database/components/embed/database-picker-modal.tsx";
import { shouldTemplateEditorOpenPicker } from "@/features/editor/components/slash-menu/db-picker-scope.ts";
import { getCellComponent } from "../table-view/cells/registry";
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
  // When true (modal host), the editor stretches to the host's fixed height and
  // the rich body fills the slack; other hosts size to content.
  fillHeight?: boolean;
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
  fillHeight,
}: TemplateRowEditorProps) {
  const { t } = useTranslation();
  const createTemplate = useCreateTemplateMutation(databaseId);
  const updateTemplate = useUpdateTemplateMutation(databaseId);

  const [name, setName] = useState(template?.name ?? "");
  const [icon, setIcon] = useState<string | null>(template?.icon ?? null);
  const [propertyValues, setPropertyValues] = useState<
    Record<string, IPropertyValue>
  >(template?.propertyValues ?? {});

  // A stable per-editor id scopes the "Database view (linked)" slash event to
  // this template editor so a co-mounted page editor can't open our picker and
  // vice versa (#113).
  const templateEditorId = useId();
  const [dbPickerOpened, setDbPickerOpened] = useState(false);

  // The embed picker needs a spaceId, but a template only carries its
  // databaseId — resolve the database to derive its space.
  const dbInfo = useDatabaseInfoByIdQuery(databaseId);
  const spaceId = dbInfo.data?.database?.spaceId;

  const editor = useEditor(
    {
      extensions: templateExtensions,
      content: template?.content ?? "",
      onCreate({ editor }) {
        // @ts-ignore - stamp the scope marker the slash item reads at dispatch.
        editor.storage.templateEditorId = templateEditorId;
      },
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
    },
    [templateEditorId],
  );

  // The "Database view (linked)" slash item can't insert synchronously (the
  // picker is a two-step async flow), so it dispatches this event; open the
  // modal only for our own scoped event (mirrors page-editor).
  useEffect(() => {
    const openPicker = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!shouldTemplateEditorOpenPicker(detail, templateEditorId)) return;
      setDbPickerOpened(true);
    };
    document.addEventListener("openDatabasePickerFromEditor", openPicker);
    return () => {
      document.removeEventListener("openDatabasePickerFromEditor", openPicker);
    };
  }, [templateEditorId]);

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
    <div className={clsx(classes.accent, fillHeight && classes.fill)}>
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
            {properties.map((property) => {
              // Reuse the grid's per-type cell editor in controlled mode: it
              // commits to onChange (local state) instead of a pageId-based
              // mutation, since a template has no backing page (#112). The
              // collab-bound GridCell is bypassed in favour of the registry cell.
              const Cell = getCellComponent(property.type);
              return (
                <Group key={property.id} wrap="nowrap" gap="md" align="center">
                  <Group gap={6} wrap="nowrap" w={140} style={{ flexShrink: 0 }}>
                    <PropertyTypeIcon type={property.type} />
                    <Text size="sm" c="dimmed" truncate>
                      {property.name}
                    </Text>
                  </Group>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Cell
                      property={property}
                      value={propertyValues[property.id]}
                      pageId=""
                      databaseId={databaseId}
                      showEmptyPlaceholder
                      onChange={(next) => setValue(property.id, next)}
                    />
                  </div>
                </Group>
              );
            })}
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
          {editor && spaceId && (
            <DatabasePickerModal
              opened={dbPickerOpened}
              spaceId={spaceId}
              onClose={() => setDbPickerOpened(false)}
              onConfirm={({ databaseId }) => {
                editor.commands.insertDatabaseView({ databaseId });
                setDbPickerOpened(false);
              }}
            />
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

export default TemplateRowEditor;
