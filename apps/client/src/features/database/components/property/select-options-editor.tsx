import { useState } from "react";
import { ActionIcon, Group, Menu, Stack, TextInput } from "@mantine/core";
import {
  IconCheck,
  IconDots,
  IconGripVertical,
  IconTrash,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { IDatabaseProperty } from "@/features/database/types/database.types.ts";
import { useUpdatePropertyMutation } from "@/features/database/queries/database-query.ts";
import {
  appendOption,
  getOptions,
  recolorOption,
  removeOption,
  renameOption,
  type SelectOption,
} from "./option-config.ts";
import { OPTION_COLORS, resolveOptionColor } from "./option-colors.ts";
import { OptionPill } from "./option-pill.tsx";

interface SelectOptionsEditorProps {
  property: IDatabaseProperty;
  databaseId: string;
}

export function SelectOptionsEditor({
  property,
  databaseId,
}: SelectOptionsEditorProps) {
  const { t } = useTranslation();
  const update = useUpdatePropertyMutation(databaseId);
  const options = getOptions(property.config);

  // config is full-replace: every change echoes the WHOLE options array (with
  // existing ids) so values pointing at untouched options never break.
  function commit(next: SelectOption[]) {
    update.mutate({ propertyId: property.id, config: { options: next } });
  }

  return (
    <Stack gap="xs">
      {options.map((o) => (
        <OptionRow
          key={o.id}
          option={o}
          onRename={(label) => commit(renameOption(options, o.id, label))}
          onRecolor={(color) => commit(recolorOption(options, o.id, color))}
          onDelete={() => commit(removeOption(options, o.id))}
        />
      ))}
      <button
        type="button"
        onClick={() => commit(appendOption(options, "Option").options)}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: 4,
          textAlign: "left",
        }}
      >
        {t("Add option")}
      </button>
    </Stack>
  );
}

interface OptionRowProps {
  option: SelectOption;
  onRename: (label: string) => void;
  onRecolor: (color: string) => void;
  onDelete: () => void;
}

function OptionRow({ option, onRename, onRecolor, onDelete }: OptionRowProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(option.label);
  const current = resolveOptionColor(option.color);

  function commitRename() {
    const next = draft.trim();
    if (next && next !== option.label) onRename(next);
  }

  return (
    <Group gap={4} wrap="nowrap" align="center">
      {/* Visual-only drag handle: reorder is intentionally out of scope, so
          there are no drag handlers attached. */}
      <IconGripVertical
        size={16}
        color="var(--mantine-color-gray-5)"
        style={{ cursor: "default", flexShrink: 0 }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <OptionPill color={option.color} label={option.label} />
      </div>
      <Menu
        position="bottom-end"
        withinPortal={false}
        closeOnItemClick={false}
        transitionProps={{ duration: 0 }}
      >
        <Menu.Target>
          <ActionIcon
            size="xs"
            variant="subtle"
            color="gray"
            aria-label={`Options for ${option.label}`}
          >
            <IconDots size={16} />
          </ActionIcon>
        </Menu.Target>
        <Menu.Dropdown>
          {/* The rename input lives in the dropdown but is NOT a Menu.Item, so
              typing/caret clicks don't trigger item selection. */}
          <div style={{ padding: "4px 8px" }}>
            <TextInput
              size="xs"
              value={draft}
              aria-label={`${option.label} label`}
              onChange={(e) => setDraft(e.currentTarget.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitRename();
              }}
            />
          </div>
          <Menu.Item
            leftSection={<IconTrash size={16} />}
            color="red"
            aria-label={`Delete ${option.label}`}
            onClick={onDelete}
          >
            {t("Delete")}
          </Menu.Item>
          <Menu.Label>{t("Color")}</Menu.Label>
          {OPTION_COLORS.map((c) => (
            <Menu.Item
              key={c.key}
              aria-label={`Set ${option.label} color ${c.key}`}
              leftSection={
                <span
                  style={{
                    display: "inline-block",
                    width: 14,
                    height: 14,
                    borderRadius: "50%",
                    background: c.dot,
                  }}
                />
              }
              rightSection={
                c.key === current.key ? <IconCheck size={14} /> : null
              }
              onClick={() => onRecolor(c.key)}
            >
              {t(c.labelKey)}
            </Menu.Item>
          ))}
        </Menu.Dropdown>
      </Menu>
    </Group>
  );
}

export default SelectOptionsEditor;
