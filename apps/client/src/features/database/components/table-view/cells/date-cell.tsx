import { useRef, useState } from "react";
import { Button, Group, Popover, Stack, Text } from "@mantine/core";
import { DatePicker } from "@mantine/dates";
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

// Relative shortcuts shown alongside the calendar so common due dates are one
// click away. Each computes its date from "now" at click time (dayjs).
const QUICK_PICKS: { label: string; compute: () => Date }[] = [
  { label: "Today", compute: () => dayjs().toDate() },
  { label: "1 day later", compute: () => dayjs().add(1, "day").toDate() },
  { label: "2 days later", compute: () => dayjs().add(2, "day").toDate() },
  { label: "3 days later", compute: () => dayjs().add(3, "day").toDate() },
  { label: "Next week", compute: () => dayjs().add(1, "week").toDate() },
];

// Normalize whatever the picker hands back (a `YYYY-MM-DD` string in Mantine v8,
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

  // A pick (quick shortcut, calendar day, or clear) commits and closes the
  // single dropdown that hosts both the shortcuts and the calendar.
  function pick(next: string | Date | null) {
    commit(next);
    setEditing(false);
  }

  const showPlaceholder = !stored && showEmptyPlaceholder;
  // The clickable display doubles as the Popover anchor while editing, so it is
  // the same element in both states (the calendar/shortcuts float from it).
  const display = (
    <Text
      size="sm"
      c={showPlaceholder ? "dimmed" : undefined}
      onClick={() => setEditing(true)}
      style={showPlaceholder ? inlinePlaceholderStyle : inlineDisplayStyle}
    >
      {stored || (showPlaceholder ? t(INLINE_EMPTY_PLACEHOLDER) : "")}
    </Text>
  );

  if (!editing) return display;

  return (
    // Rendered already-opened while editing (not a controlled toggle) so the
    // dropdown mounts synchronously. Clicking outside fires onChange(false),
    // which ends editing and unmounts the popover.
    <Popover
      opened
      onChange={(o) => {
        if (!o) setEditing(false);
      }}
      trapFocus={false}
      withinPortal
      position="bottom-start"
      shadow="md"
    >
      <Popover.Target>{display}</Popover.Target>
      <Popover.Dropdown p={8}>
        {/* One dropdown, two ways to pick: relative shortcuts on top, the full
            calendar below (#128 follow-up). */}
        <Stack gap={8}>
          <Group gap={4} wrap="wrap" aria-label={t("Quick select")}>
            {QUICK_PICKS.map((qp) => (
              <Button
                key={qp.label}
                size="compact-xs"
                variant="light"
                color="gray"
                onClick={() => pick(qp.compute())}
              >
                {t(qp.label)}
              </Button>
            ))}
          </Group>
          <DatePicker
            aria-label={property.name}
            defaultDate={stored || undefined}
            value={stored || null}
            onChange={(d) => pick(d)}
          />
          {stored && (
            <Button
              variant="subtle"
              color="gray"
              size="compact-xs"
              onClick={() => pick(null)}
            >
              {t("Clear")}
            </Button>
          )}
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}

export default DateCell;
