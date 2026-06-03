import { useState } from "react";
import { ActionIcon, Group, Stack, Text, TextInput } from "@mantine/core";
import { IconArrowLeft, IconCheck, IconTrash } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import type { SelectOption } from "./option-config.ts";
import { OPTION_COLORS, resolveOptionColor } from "./option-colors.ts";

interface OptionEditPanelProps {
  option: SelectOption;
  onRename: (label: string) => void;
  onRecolor: (colorKey: string) => void;
  onDelete: () => void;
  onBack: () => void;
}

// Inline (NOT a nested popover) option editor rendered inside the cell's
// Combobox dropdown. A nested Menu/Popover would close on the combobox's
// outside-click; keeping this a plain element avoids that.
export function OptionEditPanel({
  option,
  onRename,
  onRecolor,
  onDelete,
  onBack,
}: OptionEditPanelProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(option.label);
  const current = resolveOptionColor(option.color);

  function commitRename() {
    const next = draft.trim();
    if (next && next !== option.label) onRename(next);
  }

  return (
    <div style={{ padding: 4 }}>
      <Group gap={4} wrap="nowrap" align="center">
        <ActionIcon
          size="sm"
          variant="subtle"
          color="gray"
          aria-label="Back to options"
          onClick={onBack}
        >
          <IconArrowLeft size={16} />
        </ActionIcon>
        <TextInput
          size="xs"
          style={{ flex: 1 }}
          value={draft}
          aria-label={`${option.label} label`}
          onChange={(e) => setDraft(e.currentTarget.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitRename();
          }}
        />
        <ActionIcon
          size="sm"
          variant="subtle"
          color="red"
          aria-label={`Delete ${option.label}`}
          onClick={onDelete}
        >
          <IconTrash size={16} />
        </ActionIcon>
      </Group>
      <Text size="xs" c="dimmed" mt={6} mb={4}>
        {t("Color")}
      </Text>
      <Stack gap={0}>
        {OPTION_COLORS.map((c) => (
          <Group
            key={c.key}
            gap="xs"
            wrap="nowrap"
            role="button"
            aria-label={`Set ${option.label} color ${c.key}`}
            onClick={() => onRecolor(c.key)}
            style={{ cursor: "pointer", padding: "4px 6px", borderRadius: 4 }}
          >
            <span
              style={{
                display: "inline-block",
                width: 14,
                height: 14,
                borderRadius: "50%",
                background: c.dot,
                flexShrink: 0,
              }}
            />
            <Text size="sm" style={{ flex: 1 }}>
              {t(c.labelKey)}
            </Text>
            {c.key === current.key && <IconCheck size={14} />}
          </Group>
        ))}
      </Stack>
    </div>
  );
}

export default OptionEditPanel;
