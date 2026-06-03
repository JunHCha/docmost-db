import { useState } from "react";
import { Text } from "@mantine/core";
import { DateInput } from "@mantine/dates";
import dayjs from "dayjs";
import {
  useClearValueMutation,
  useSetValueMutation,
} from "@/features/database/queries/database-query.ts";
import { CellProps } from "./cell-props";

const ISO = "YYYY-MM-DD";

// Normalize whatever DateInput hands back (a `YYYY-MM-DD` string in Mantine v8,
// or a Date) into the ISO date-only string the backend stores (conventions §1).
function toIso(value: string | Date | null): string {
  if (!value) return "";
  const d = dayjs(value);
  return d.isValid() ? d.format(ISO) : "";
}

export function DateCell({ property, value, pageId, databaseId }: CellProps) {
  const setValue = useSetValueMutation(databaseId);
  const clearValue = useClearValueMutation(databaseId);
  const stored = typeof value?.value === "string" ? value.value : "";
  const [editing, setEditing] = useState(false);

  function commit(next: string | Date | null) {
    setEditing(false);
    const iso = toIso(next);
    if (iso === stored) return;
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
        onBlur={(e) => commit(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setEditing(false);
        }}
      />
    );
  }

  return (
    <Text
      size="sm"
      onClick={() => setEditing(true)}
      style={{ cursor: "text", minHeight: 20 }}
    >
      {stored}
    </Text>
  );
}

export default DateCell;
