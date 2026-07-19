import { useRef, useState } from "react";
import { Button, Popover, Stack, Text } from "@mantine/core";
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

// Relative shortcuts offered above the calendar so common due dates are one
// click away. Each computes its date from "now" at click time (dayjs).
const QUICK_PICKS: { label: string; compute: () => Date }[] = [
  { label: "Today", compute: () => dayjs().toDate() },
  { label: "1 day later", compute: () => dayjs().add(1, "day").toDate() },
  { label: "2 days later", compute: () => dayjs().add(2, "day").toDate() },
  { label: "3 days later", compute: () => dayjs().add(3, "day").toDate() },
  { label: "Next week", compute: () => dayjs().add(1, "week").toDate() },
];

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
  onChange,
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
    if (onChange) {
      onChange(iso === "" ? undefined : { type: "date", value: iso });
      return;
    }
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

  function pick(date: Date) {
    commit(date);
    setEditing(false);
  }

  if (editing) {
    return (
      <Popover
        opened
        trapFocus={false}
        withinPortal
        position="bottom-start"
        shadow="md"
      >
        <Popover.Target>
          <div style={{ width: "100%" }}>
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
          </div>
        </Popover.Target>
        <Popover.Dropdown p={4}>
          <Stack gap={2}>
            {QUICK_PICKS.map((qp) => (
              <Button
                key={qp.label}
                variant="subtle"
                color="gray"
                size="xs"
                justify="flex-start"
                // Keep the DateInput focused so its onBlur does not close the
                // editor before the click commits.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(qp.compute())}
              >
                {t(qp.label)}
              </Button>
            ))}
          </Stack>
        </Popover.Dropdown>
      </Popover>
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
