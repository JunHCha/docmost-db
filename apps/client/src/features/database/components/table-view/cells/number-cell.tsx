import { useState } from "react";
import { TextInput, Text } from "@mantine/core";
import { useTranslation } from "react-i18next";
import {
  useClearValueMutation,
  useSetValueMutation,
} from "@/features/database/queries/database-query.ts";
import { CellProps } from "./cell-props";
import {
  INLINE_EMPTY_PLACEHOLDER,
  inlineDisplayStyle,
  inlineInputStyles,
} from "./inline-text";

export function NumberCell({ property, value, pageId, databaseId }: CellProps) {
  const { t } = useTranslation();
  const setValue = useSetValueMutation(databaseId);
  const clearValue = useClearValueMutation(databaseId);
  const stored = typeof value?.value === "number" ? String(value.value) : "";
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(stored);

  function startEdit() {
    setDraft(stored);
    setEditing(true);
  }

  function commit() {
    setEditing(false);
    const next = draft.trim();
    if (next === stored) return;
    if (next === "") {
      clearValue.mutate({ pageId, propertyId: property.id });
      return;
    }
    const num = Number(next);
    if (Number.isNaN(num)) return;
    setValue.mutate({
      pageId,
      propertyId: property.id,
      value: { type: "number", value: num },
    });
  }

  if (editing) {
    return (
      <TextInput
        autoFocus
        type="number"
        size="sm"
        variant="unstyled"
        styles={inlineInputStyles}
        value={draft}
        aria-label={property.name}
        onChange={(e) => setDraft(e.currentTarget.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") setEditing(false);
        }}
      />
    );
  }

  return (
    <Text
      size="sm"
      c={stored ? undefined : "dimmed"}
      onClick={startEdit}
      style={inlineDisplayStyle}
    >
      {stored || t(INLINE_EMPTY_PLACEHOLDER)}
    </Text>
  );
}

export default NumberCell;
