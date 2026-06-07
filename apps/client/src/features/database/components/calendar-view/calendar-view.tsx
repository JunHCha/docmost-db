import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActionIcon,
  Box,
  Group,
  Popover,
  SimpleGrid,
  Stack,
  Text,
  UnstyledButton,
} from "@mantine/core";
import {
  IconChevronLeft,
  IconChevronRight,
} from "@tabler/icons-react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import dayjs, { Dayjs } from "dayjs";
import { dropTargetForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import {
  IDatabaseProperty,
  IDatabaseRow,
  IDatabaseView,
} from "@/features/database/types/database.types.ts";
import { useSetValueMutation } from "@/features/database/queries/database-query.ts";
import { patchRowValue } from "@/features/database/queries/database-cache.ts";
import { layoutRows, CalendarBar as BarData } from "./layout-rows";
import { dateCandidates } from "./calendar-config";
import { monthGrid } from "./month-grid";
import { CalendarBar } from "./calendar-bar";
import { CALENDAR_BAR_DRAG } from "./calendar-dnd";

const ISO = "YYYY-MM-DD";
const MAX_VISIBLE = 3;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface CalendarViewProps {
  databaseId: string;
  properties: IDatabaseProperty[];
  rows: IDatabaseRow[];
  activeView: IDatabaseView;
  spaceSlug?: string;
  // Persist an auto-adopted date property back to the view config. Omitted in
  // embed (session-only) mode, where adoption is render-time fallback only.
  onAutoAdoptDate?: (id: string) => void;
}

// A bar occupies every day from startDay..endDay; index it per day-of-month so
// each cell can render the bars that touch it.
function barsByDay(bars: BarData[]): Map<number, BarData[]> {
  const map = new Map<number, BarData[]>();
  for (const bar of bars) {
    for (let d = bar.startDay; d <= bar.endDay; d++) {
      const list = map.get(d) ?? [];
      list.push(bar);
      map.set(d, list);
    }
  }
  return map;
}

// One day cell: a drop target for single-date bars (a drop rewrites that bar's
// date property to this day). Cells outside the visible month render dimmed.
function DayCell({
  date,
  inMonth,
  bars,
  spaceSlug,
  onDropOnDay,
}: {
  date: Dayjs;
  inMonth: boolean;
  bars: BarData[];
  spaceSlug?: string;
  onDropOnDay: (rowId: string, propertyIds: string[], date: Dayjs) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [over, setOver] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || !inMonth) return;
    return dropTargetForElements({
      element: el,
      canDrop: ({ source }) => source.data.context === CALENDAR_BAR_DRAG,
      onDragEnter: () => setOver(true),
      onDragLeave: () => setOver(false),
      onDrop: ({ source }) => {
        setOver(false);
        const propertyIds = source.data.propertyIds as string[] | undefined;
        if (!propertyIds?.length) return;
        onDropOnDay(source.data.id as string, propertyIds, date);
      },
    });
  }, [inMonth, date, onDropOnDay]);

  const visible = bars.slice(0, MAX_VISIBLE);
  const overflow = bars.slice(MAX_VISIBLE);
  const isToday = date.isSame(dayjs(), "day");

  return (
    <Box
      ref={ref}
      data-testid="calendar-day"
      data-date={date.format(ISO)}
      style={{
        minHeight: 96,
        border: "1px solid var(--mantine-color-gray-2)",
        borderRadius: 4,
        padding: 4,
        background: over
          ? "var(--mantine-color-blue-light)"
          : inMonth
            ? undefined
            : "var(--mantine-color-gray-0)",
      }}
    >
      <Text
        size="xs"
        c={inMonth ? (isToday ? "blue" : "dimmed") : "dimmed"}
        fw={isToday ? 700 : 400}
        ta="right"
        mb={2}
      >
        {date.date()}
      </Text>
      {inMonth && (
        <Stack gap={2}>
          {visible.map((bar) => (
            <CalendarBar
              key={bar.row.row.id}
              bar={bar}
              spaceSlug={spaceSlug}
            />
          ))}
          {overflow.length > 0 && (
            <Popover position="bottom" withinPortal shadow="md">
              <Popover.Target>
                <UnstyledButton
                  data-testid="calendar-overflow"
                  style={{ fontSize: "var(--mantine-font-size-xs)" }}
                >
                  <Text size="xs" c="dimmed">
                    +{overflow.length}
                  </Text>
                </UnstyledButton>
              </Popover.Target>
              <Popover.Dropdown>
                <Text size="xs" fw={600} mb={4}>
                  {date.format("MMM D")}
                </Text>
                <Stack gap={2} style={{ minWidth: 160 }}>
                  {bars.map((bar) => (
                    <CalendarBar
                      key={bar.row.row.id}
                      bar={bar}
                      spaceSlug={spaceSlug}
                    />
                  ))}
                </Stack>
              </Popover.Dropdown>
            </Popover>
          )}
        </Stack>
      )}
    </Box>
  );
}

export function CalendarView({
  databaseId,
  properties,
  rows,
  activeView,
  spaceSlug,
  onAutoAdoptDate,
}: CalendarViewProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const setValue = useSetValueMutation(databaseId);
  const [month, setMonth] = useState(() => dayjs().startOf("month"));

  const datePropertyId = activeView.config.datePropertyId;

  // Guard against a stale config pointing at a non-date (or deleted) property.
  const validDateId = useMemo(() => {
    const p = properties.find((p) => p.id === datePropertyId);
    return p && p.type === "date" ? p.id : undefined;
  }, [properties, datePropertyId]);

  // When nothing valid is configured, adopt the first date column. effectiveId
  // drives the render so the grid shows immediately (even in embed mode where
  // adoption is not persisted), and the effect below writes it back once.
  const firstCandidate = useMemo(
    () => dateCandidates(properties)[0]?.id,
    [properties],
  );
  const effectiveDateId = validDateId ?? firstCandidate;

  useEffect(() => {
    // Persist the auto-adoption exactly once: only when the config has no valid
    // date property but a candidate exists. Guarding on validDateId/datePropertyId
    // prevents re-firing after the write echoes back.
    if (!validDateId && firstCandidate && datePropertyId !== firstCandidate) {
      onAutoAdoptDate?.(firstCandidate);
    }
  }, [validDateId, firstCandidate, datePropertyId, onAutoAdoptDate]);

  const cells = useMemo(() => monthGrid(month), [month]);
  const dayMap = useMemo(
    () => barsByDay(layoutRows(rows, effectiveDateId, month)),
    [rows, effectiveDateId, month],
  );

  // Move a bar onto the dropped day: optimistically patch the rows cache so the
  // chip jumps immediately, then persist via set-value (its onError invalidates
  // the rows prefix and rolls back). The bar carries the single date property id.
  const onDropOnDay = useCallback(
    (rowId: string, propertyIds: string[], date: Dayjs) => {
      const value = { type: "date" as const, value: date.format(ISO) };
      for (const propertyId of propertyIds) {
        patchRowValue(queryClient, databaseId, {
          id: `optimistic-${rowId}-${propertyId}`,
          pageId: rowId,
          propertyId,
          value,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        setValue.mutate({ pageId: rowId, propertyId, value });
      }
    },
    [queryClient, databaseId, setValue],
  );

  return (
    <Stack gap="sm" data-testid="calendar-view">
      <Group justify="space-between">
        <Text fw={600}>{month.format("MMMM YYYY")}</Text>
        <Group gap="xs">
          <ActionIcon
            variant="subtle"
            aria-label={t("Previous month")}
            onClick={() => setMonth((m) => m.subtract(1, "month"))}
          >
            <IconChevronLeft size={16} />
          </ActionIcon>
          <UnstyledButton
            onClick={() => setMonth(dayjs().startOf("month"))}
            style={{ fontSize: "var(--mantine-font-size-sm)" }}
          >
            {t("Today")}
          </UnstyledButton>
          <ActionIcon
            variant="subtle"
            aria-label={t("Next month")}
            onClick={() => setMonth((m) => m.add(1, "month"))}
          >
            <IconChevronRight size={16} />
          </ActionIcon>
        </Group>
      </Group>

      {!effectiveDateId ? (
        // Only reachable when the database has no date column at all; otherwise
        // the first candidate is auto-adopted above.
        <Box p="xl">
          <Text c="dimmed">{t("No date property")}</Text>
        </Box>
      ) : (
        <>
          <SimpleGrid cols={7} spacing={4}>
            {WEEKDAYS.map((d) => (
              <Text key={d} size="xs" c="dimmed" ta="center" fw={500}>
                {t(d)}
              </Text>
            ))}
          </SimpleGrid>
          <SimpleGrid cols={7} spacing={4}>
            {cells.map((date) => {
              const inMonth = date.isSame(month, "month");
              return (
                <DayCell
                  key={date.format(ISO)}
                  date={date}
                  inMonth={inMonth}
                  bars={inMonth ? (dayMap.get(date.date()) ?? []) : []}
                  spaceSlug={spaceSlug}
                  onDropOnDay={onDropOnDay}
                />
              );
            })}
          </SimpleGrid>
        </>
      )}
    </Stack>
  );
}

export default CalendarView;
