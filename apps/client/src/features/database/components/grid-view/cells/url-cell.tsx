import { useState } from "react";
import { TextInput, Anchor } from "@mantine/core";
import {
  useClearValueMutation,
  useSetValueMutation,
} from "@/features/database/queries/database-query.ts";
import { CellProps } from "./cell-props";

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
        size="xs"
        variant="unstyled"
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

  if (!stored) {
    return (
      <div
        onClick={startEdit}
        style={{ cursor: "text", minHeight: 20, width: "100%" }}
      />
    );
  }

  return (
    <Anchor
      href={stored}
      target="_blank"
      rel="noreferrer"
      size="sm"
      onClick={(e) => {
        e.preventDefault();
        startEdit();
      }}
    >
      {stored}
    </Anchor>
  );
}

export default UrlCell;
