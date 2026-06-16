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

// Turn a stored url into an absolute href. A scheme-less value like
// "google.com" would otherwise be treated by the browser as a path relative to
// the current site (→ <app-origin>/google.com), so we assume https. Values that
// already carry a scheme (http://, https://, ftp://, mailto:, tel:, …) or are
// protocol-relative (//host) are left as-is.
function toHref(raw: string): string {
  const v = raw.trim();
  // Local/file targets. Windows paths copied from File Explorer come in two
  // shapes; map both to a standard file URL so an environment that permits
  // file:// navigation (intranet zone, group policy, older Edge/IE) opens them:
  //   \\server\share\path  (UNC)   -> file://server/share/path
  //   C:\path              (drive) -> file:///C:/path
  // file:// values are kept as-is. The path is then percent-encoded so spaces/
  // unicode are valid; decodeURI first keeps it idempotent (no %20 -> %2520).
  let fileish: string | null = null;
  if (/^\\\\/.test(v)) {
    fileish = "file:" + v.replace(/\\/g, "/"); // \\server -> file://server
  } else if (/^[a-zA-Z]:[\\/]/.test(v)) {
    fileish = "file:///" + v.replace(/\\/g, "/"); // C:\ -> file:///C:/
  } else if (/^file:/i.test(v)) {
    fileish = v;
  }
  if (fileish) {
    try {
      return encodeURI(decodeURI(fileish));
    } catch {
      return encodeURI(fileish);
    }
  }
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(v)) return v; // scheme://host
  if (/^(mailto:|tel:)/i.test(v)) return v; // schemes without //
  if (v.startsWith("//")) return `https:${v}`; // protocol-relative
  return `https://${v}`; // bare host/path → assume https
}

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
          href={toHref(stored)}
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
