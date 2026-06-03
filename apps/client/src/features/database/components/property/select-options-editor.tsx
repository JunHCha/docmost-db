import { useState } from "react";
import { ActionIcon, ColorSwatch, Group, Stack, TextInput } from "@mantine/core";
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

interface SelectOptionsEditorProps {
  property: IDatabaseProperty;
  databaseId: string;
}

export function SelectOptionsEditor({
  property,
  databaseId,
}: SelectOptionsEditorProps) {
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
        Add option
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
  const [draft, setDraft] = useState(option.label);

  function commitRename() {
    const next = draft.trim();
    if (next && next !== option.label) onRename(next);
  }

  const current = resolveOptionColor(option.color);

  // Label on its own full-width row (otherwise the 10-swatch row squeezed the
  // input to near-zero width and clipped the label text); swatches wrap below.
  return (
    <Stack gap={4}>
      <Group gap={4} wrap="nowrap" align="center">
        <TextInput
          size="xs"
          value={draft}
          aria-label={`${option.label} label`}
          onChange={(e) => setDraft(e.currentTarget.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitRename();
          }}
          style={{ flex: 1 }}
        />
        <ActionIcon
          size="xs"
          variant="subtle"
          color="red"
          aria-label={`Delete ${option.label}`}
          onClick={onDelete}
        >
          ✕
        </ActionIcon>
      </Group>
      <Group gap={4} wrap="wrap">
        {OPTION_COLORS.map((c) => (
          <ColorSwatch
            key={c}
            component="button"
            color={`var(--mantine-color-${c}-5)`}
            size={14}
            aria-label={`Set ${option.label} color ${c}`}
            onClick={() => onRecolor(c)}
            withShadow={c === current}
            style={{
              cursor: "pointer",
              outline:
                c === current ? "2px solid var(--mantine-color-dark-4)" : "none",
            }}
          />
        ))}
      </Group>
    </Stack>
  );
}

export default SelectOptionsEditor;
