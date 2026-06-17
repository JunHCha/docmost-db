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
  inlinePlaceholderStyle,
} from "./inline-text";

export function TextCell({
  property,
  value,
  pageId,
  databaseId,
  showEmptyPlaceholder,
}: CellProps) {
  const { t } = useTranslation();
  const setValue = useSetValueMutation(databaseId);
  const clearValue = useClearValueMutation(databaseId);
  const stored = typeof value?.value === "string" ? value.value : "";
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
    } else {
      setValue.mutate({
        pageId,
        propertyId: property.id,
        value: { type: "text", value: next },
      });
    }
  }

  if (editing) {
    return (
      <TextInput
        autoFocus
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

  const showPlaceholder = !stored && showEmptyPlaceholder;
  return (
    <Text
      size="sm"
      c={showPlaceholder ? "dimmed" : undefined}
      onClick={startEdit}
      style={showPlaceholder ? inlinePlaceholderStyle : inlineDisplayStyle}
    >
      {stored || (showPlaceholder ? t(INLINE_EMPTY_PLACEHOLDER) : "")}
    </Text>
  );
}

export default TextCell;
