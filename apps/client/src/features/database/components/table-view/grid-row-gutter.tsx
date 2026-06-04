import { Checkbox } from "@mantine/core";
import { useTranslation } from "react-i18next";

export interface RowSelectModifiers {
  shift: boolean;
  meta: boolean;
}

interface GutterHeaderCheckboxProps {
  checked: boolean;
  indeterminate: boolean;
  onToggleAll: () => void;
}

// thead gutter cell: select/deselect every visible row, indeterminate when a
// subset is selected.
export function GutterHeaderCheckbox({
  checked,
  indeterminate,
  onToggleAll,
}: GutterHeaderCheckboxProps) {
  const { t } = useTranslation();
  return (
    <Checkbox
      aria-label={t("Select all rows")}
      checked={checked}
      indeterminate={indeterminate}
      onChange={onToggleAll}
    />
  );
}

interface GutterRowCheckboxProps {
  checked: boolean;
  onSelect: (mods: RowSelectModifiers) => void;
}

// tbody gutter cell. Hidden until the row is hovered or selected (CSS in
// table-view via the db-row-gutter class), so it never competes with the cell
// editing / open-row affordances. Click modifiers drive range / toggle select.
export function GutterRowCheckbox({ checked, onSelect }: GutterRowCheckboxProps) {
  const { t } = useTranslation();
  return (
    <Checkbox
      aria-label={t("Select row")}
      checked={checked}
      readOnly
      onClick={(e) => {
        // Keep the click off the row so it never triggers open-row navigation.
        e.stopPropagation();
        onSelect({ shift: e.shiftKey, meta: e.metaKey || e.ctrlKey });
      }}
    />
  );
}
