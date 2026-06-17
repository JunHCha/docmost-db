import { useRef, useState } from "react";
import { Text } from "@mantine/core";
import { DateInput } from "@mantine/dates";
import dayjs from "dayjs";
import { useTranslation } from "react-i18next";
import {
  useClearValueMutation,
  useSetValueMutation,
} from "@/features/database/queries/database-query.ts";
import { CellProps } from "./cell-props";
import {
  INLINE_EMPTY_PLACEHOLDER,
  inlineDisplayStyle,
  inlinePlaceholderStyle,
} from "./inline-text";

const ISO = "YYYY-MM-DD";

// Normalize whatever DateInput hands back (a `YYYY-MM-DD` string in Mantine v8,
// or a Date) into the ISO date-only string the backend stores (conventions §1).
function toIso(value: string | Date | null): string {
  if (!value) return "";
  const d = dayjs(value);
  return d.isValid() ? d.format(ISO) : "";
}

export function DateCell({
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
  // Remember the last value we committed so a repeated onChange can't re-fire the
  // same mutation while `stored` is still stale. Seed with a sentinel so an empty
  // commit (clear) on first edit is not mistaken for a duplicate.
  const lastCommitted = useRef<string | null>(null);

  function commit(next: string | Date | null) {
    const iso = toIso(next);
    if (iso === stored || iso === lastCommitted.current) return;
    lastCommitted.current = iso;
    if (iso === "") {
      clearValue.mutate({ pageId, propertyId: property.id });
    } else {
      setValue.mutate({
        pageId,
        propertyId: property.id,
        value: { type: "date", value: iso },
      });
    }
  }

  if (editing) {
    return (
      <DateInput
        autoFocus
        size="xs"
        variant="unstyled"
        valueFormat={ISO}
        clearable
        defaultValue={stored || null}
        aria-label={property.name}
        onChange={commit}
        onBlur={() => setEditing(false)}
        onKeyDown={(e) => {
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
      onClick={() => setEditing(true)}
      style={showPlaceholder ? inlinePlaceholderStyle : inlineDisplayStyle}
    >
      {stored || (showPlaceholder ? t(INLINE_EMPTY_PLACEHOLDER) : "")}
    </Text>
  );
}

export default DateCell;
