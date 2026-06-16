import { useState } from "react";
import { TextInput, Anchor, ActionIcon, Group } from "@mantine/core";
import { IconPencil } from "@tabler/icons-react";
import {
  useClearValueMutation,
  useSetValueMutation,
} from "@/features/database/queries/database-query.ts";
import { CellProps } from "./cell-props";
import {
  INLINE_ROW_HEIGHT,
  inlineDisplayStyle,
  inlineInputStyles,
} from "./inline-text";

export function UrlCell({ property, value, pageId, databaseId }: CellProps) {
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
        value: { type: "url", value: next },
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

  // Display mode: the link itself navigates (issue #85 — clicking the link must
  // open the URL, not enter edit mode). A separate hover-revealed pencil enters
  // edit mode, mirroring the Title column's link/edit split, so the two actions
  // are never conflated.
  return (
    <Group gap={4} wrap="nowrap" className="db-url-cell">
      {stored ? (
        <Anchor
          href={stored}
          target="_blank"
          rel="noreferrer"
          size="sm"
          style={{
            flex: 1,
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            lineHeight: `${INLINE_ROW_HEIGHT}px`,
          }}
        >
          {stored}
        </Anchor>
      ) : (
        <div
          onClick={startEdit}
          style={{ ...inlineDisplayStyle, flex: 1, minWidth: 0 }}
        />
      )}
      <ActionIcon
        variant="subtle"
        size="sm"
        aria-label={`Edit ${property.name}`}
        onClick={startEdit}
      >
        <IconPencil size={14} />
      </ActionIcon>
    </Group>
  );
}

export default UrlCell;
