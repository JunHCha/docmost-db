import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActionIcon,
  Box,
  Group,
  Menu,
  Popover,
  SimpleGrid,
  Stack,
  Text,
  UnstyledButton,
} from "@mantine/core";
import {
  IconChevronLeft,
  IconChevronRight,
  IconPlus,
} from "@tabler/icons-react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import dayjs, { Dayjs } from "dayjs";
import { dropTargetForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import {
  IDatabaseProperty,
  IDatabaseRow,
  IDatabaseTemplate,
  IDatabaseView,
} from "@/features/database/types/database.types.ts";
import {
  useCreateRowMutation,
  useDatabaseTemplatesQuery,
  useSetValueMutation,
} from "@/features/database/queries/database-query.ts";
import { patchRowValue } from "@/features/database/queries/database-cache.ts";
import { layoutRows, CalendarBar as BarData } from "./layout-rows";
import { packBars, WeekSegment } from "./week-lanes";
import { dateCandidates } from "./calendar-config";
import { monthGrid } from "./month-grid";
import { CalendarBar, CalendarBarDrag } from "./calendar-bar";
import { CALENDAR_BAR_DRAG } from "./calendar-dnd";
import classes from "./calendar-view.module.css";

const ISO = "YYYY-MM-DD";
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
// The single divider colour for the whole grid. Cells draw their right/bottom
// edge in it and the grid wrapper draws the top/left, so the month reads as one
// lined table rather than a set of spaced cards.
const CALENDAR_LINE = "var(--mantine-color-gray-3)";

// Vertical layout of a day cell: the date number sits on top; bars occupy up to
// MAX_LANES stacked lanes below it, and a reserved strip holds the "+N" overflow
// control so every week row stays the same height.
const DAY_NUM_H = 22;
const BAR_H = 18;
const BAR_GAP = 2;
const MAX_LANES = 3;
const OVERFLOW_H = 16;
const CELL_MIN_H =
  DAY_NUM_H + MAX_LANES * (BAR_H + BAR_GAP) + OVERFLOW_H + BAR_GAP;

interface CalendarViewProps {
  databaseId: string;
  properties: IDatabaseProperty[];
  rows: IDatabaseRow[];
  activeView: IDatabaseView;
  // Persist an auto-adopted date property back to the view config. Omitted in
  // embed (session-only) mode, where adoption is render-time fallback only.
  onAutoAdoptDate?: (id: string) => void;
}

// One day cell: the date number, a hover "+" to add a row on this day, and a
// drop target. Dropping a bar here applies it to this day — moving the whole
// span or resizing one end per the drag mode (see onBarDrop). Bars themselves
// are drawn by the week overlay, not inside the cell, so a span can cross
// column boundaries.
function DayCell({
  date,
  inMonth,
  onBarDrop,
  templates,
  onCreate,
}: {
  date: Dayjs;
  inMonth: boolean;
  onBarDrop: (drag: CalendarBarDrag, date: Dayjs) => void;
  templates: IDatabaseTemplate[];
  onCreate: (templateId: string | null, date: Dayjs) => void;
}) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const [over, setOver] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return dropTargetForElements({
      element: el,
      canDrop: ({ source }) => source.data.context === CALENDAR_BAR_DRAG,
      onDragEnter: () => setOver(true),
      onDragLeave: () => setOver(false),
      onDrop: ({ source }) => {
        setOver(false);
        onBarDrop(source.data as unknown as CalendarBarDrag, date);
      },
    });
  }, [date, onBarDrop]);

  const isToday = date.isSame(dayjs(), "day");

  return (
    <Box
      ref={ref}
      data-testid="calendar-day"
      data-date={date.format(ISO)}
      className={classes.cell}
      style={{
        minHeight: CELL_MIN_H,
        // Each cell draws only its right/bottom edge; the grid wrapper draws the
        // top/left so adjacent cells meet on one shared 1px line (no gaps).
        borderRight: `1px solid ${CALENDAR_LINE}`,
        borderBottom: `1px solid ${CALENDAR_LINE}`,
        padding: 4,
        background: over
          ? "var(--mantine-color-blue-light)"
          : inMonth
            ? undefined
            : "var(--mantine-color-gray-0)",
      }}
    >
      <Menu
        position="bottom-start"
        shadow="md"
        withinPortal
        opened={menuOpen}
        onChange={setMenuOpen}
        transitionProps={{ duration: 0 }}
      >
        <Menu.Target>
          <ActionIcon
            className={classes.addButton}
            data-open={menuOpen || undefined}
            variant="subtle"
            size="sm"
            aria-label={t("Add")}
          >
            <IconPlus size={14} />
          </ActionIcon>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Item onClick={() => onCreate(null, date)}>
            {t("New page")}
          </Menu.Item>
          {templates.length > 0 && (
            <>
              <Menu.Divider />
              <Menu.Label>{t("From template")}</Menu.Label>
              {templates.map((template) => (
                <Menu.Item
                  key={template.id}
                  leftSection={template.icon ?? undefined}
                  onClick={() => onCreate(template.id, date)}
                >
                  {template.name}
                </Menu.Item>
              ))}
            </>
          )}
        </Menu.Dropdown>
      </Menu>
      <Text
        size="xs"
        c={inMonth ? (isToday ? "blue" : "dimmed") : "dimmed"}
        fw={isToday ? 700 : 400}
        ta="right"
      >
        {date.date()}
      </Text>
    </Box>
  );
}

// The bars (and any "+N more") of a single week, absolutely positioned over its
// day-cell grid. Column position comes from the segment's start/end column; the
// vertical lane keeps a multi-week bar on one row across the whole grid.
function WeekBars({
  segments,
  overflow,
  weekBars,
}: {
  segments: WeekSegment[];
  overflow: number;
  weekBars: BarData[];
}) {
  const { t } = useTranslation();
  const colPct = (col: number) => (col / 7) * 100;

  return (
    <>
      {segments.map((seg) => {
        const leftInset = seg.continuesLeft ? 0 : 3;
        const rightInset = seg.continuesRight ? 0 : 3;
        return (
          <CalendarBar
            key={seg.bar.row.row.id}
            bar={seg.bar}
            resizable={!seg.bar.singleDay}
            continuesLeft={seg.continuesLeft}
            continuesRight={seg.continuesRight}
            style={{
              position: "absolute",
              left: `calc(${colPct(seg.startCol)}% + ${leftInset}px)`,
              width: `calc(${colPct(seg.endCol - seg.startCol + 1)}% - ${
                leftInset + rightInset
              }px)`,
              top: DAY_NUM_H + seg.lane * (BAR_H + BAR_GAP),
              height: BAR_H,
            }}
          />
        );
      })}
      {overflow > 0 && (
        <Box
          style={{
            position: "absolute",
            left: 4,
            top: DAY_NUM_H + MAX_LANES * (BAR_H + BAR_GAP),
          }}
        >
          <Popover position="bottom-start" withinPortal shadow="md">
            <Popover.Target>
              <UnstyledButton
                data-testid="calendar-overflow"
                style={{ fontSize: "var(--mantine-font-size-xs)" }}
              >
                <Text size="xs" c="dimmed">
                  +{overflow} {t("more")}
                </Text>
              </UnstyledButton>
            </Popover.Target>
            <Popover.Dropdown>
              <Stack gap={2} style={{ minWidth: 180 }}>
                {weekBars.map((bar) => (
                  <CalendarBar key={bar.row.row.id} bar={bar} />
                ))}
              </Stack>
            </Popover.Dropdown>
          </Popover>
        </Box>
      )}
    </>
  );
}

export function CalendarView({
  databaseId,
  properties,
  rows,
  activeView,
  onAutoAdoptDate,
}: CalendarViewProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const setValue = useSetValueMutation(databaseId);
  const createRow = useCreateRowMutation(databaseId);
  const templates = useDatabaseTemplatesQuery(databaseId).data ?? [];
  const [month, setMonth] = useState(() => dayjs().startOf("month"));

  const datePropertyId = activeView.config.datePropertyId;
  const endDatePropertyId = activeView.config.endDatePropertyId;

  // Guard against a stale config pointing at a non-date (or deleted) property.
  const validId = useCallback(
    (id: string | undefined) => {
      const p = properties.find((p) => p.id === id);
      return p && p.type === "date" ? p.id : undefined;
    },
    [properties],
  );
  const validDateId = useMemo(
    () => validId(datePropertyId),
    [validId, datePropertyId],
  );
  const validEndDateId = useMemo(
    () => validId(endDatePropertyId),
    [validId, endDatePropertyId],
  );

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
  const weekCount = cells.length / 7;
  const bars = useMemo(
    () => layoutRows(rows, effectiveDateId, validEndDateId, cells),
    [rows, effectiveDateId, validEndDateId, cells],
  );
  const packed = useMemo(
    () => packBars(bars, weekCount, MAX_LANES),
    [bars, weekCount],
  );
  // Bars intersecting each week, listed in the "+N more" popover.
  const barsByWeek = useMemo(() => {
    const map = new Map<number, BarData[]>();
    for (const bar of bars) {
      const first = Math.floor(bar.startIndex / 7);
      const last = Math.floor(bar.endIndex / 7);
      for (let w = first; w <= last; w++) {
        const list = map.get(w) ?? [];
        list.push(bar);
        map.set(w, list);
      }
    }
    return map;
  }, [bars]);

  // Persist one date property, optimistically patching the rows cache first (its
  // onError invalidates the rows prefix and rolls back).
  const setDate = useCallback(
    (rowId: string, propertyId: string, iso: string) => {
      const value = { type: "date" as const, value: iso };
      patchRowValue(queryClient, databaseId, {
        id: `optimistic-${rowId}-${propertyId}`,
        pageId: rowId,
        propertyId,
        value,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      setValue.mutate({ pageId: rowId, propertyId, value });
    },
    [queryClient, databaseId, setValue],
  );

  // Apply a dropped bar to the dropped day. move shifts both dates by the drop
  // delta so a multi-day span keeps its length; resize sets just that end,
  // clamped so the start never passes the end.
  const onBarDrop = useCallback(
    (drag: CalendarBarDrag, date: Dayjs) => {
      const dropISO = date.format(ISO);
      const start = dayjs(drag.startISO, ISO);
      const end = dayjs(drag.endISO, ISO);

      if (drag.mode === "resize-start" && drag.endDatePropertyId) {
        const iso = date.isAfter(end, "day") ? drag.endISO : dropISO;
        setDate(drag.id, drag.startDatePropertyId, iso);
        return;
      }
      if (drag.mode === "resize-end" && drag.endDatePropertyId) {
        const iso = date.isBefore(start, "day") ? drag.startISO : dropISO;
        setDate(drag.id, drag.endDatePropertyId, iso);
        return;
      }

      // move: round the fractional day diff (DST-safe, see layout-rows).
      const delta = Math.round(date.diff(start, "day", true));
      setDate(drag.id, drag.startDatePropertyId, dropISO);
      if (drag.endDatePropertyId) {
        setDate(
          drag.id,
          drag.endDatePropertyId,
          end.add(delta, "day").format(ISO),
        );
      }
    },
    [setDate],
  );

  // Add a row on a day: seed the (start) date property with that day so the new
  // row lands on the clicked cell. A templateId, when given, is applied
  // server-side; template values win where they overlap the seeded date.
  const onCreate = useCallback(
    (templateId: string | null, date: Dayjs) => {
      createRow.mutate({
        databaseId,
        ...(templateId ? { templateId } : {}),
        initialValues: effectiveDateId
          ? { [effectiveDateId]: { type: "date", value: date.format(ISO) } }
          : {},
      });
    },
    [createRow, databaseId, effectiveDateId],
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
          <SimpleGrid cols={7} spacing={0}>
            {WEEKDAYS.map((d) => (
              <Text key={d} size="xs" c="dimmed" ta="center" fw={500} pb={4}>
                {t(d)}
              </Text>
            ))}
          </SimpleGrid>
          {/* The wrapper supplies the grid's top and left edge; each cell draws
              only its right/bottom edge so cells meet on shared 1px lines. */}
          <Box
            style={{
              borderTop: `1px solid ${CALENDAR_LINE}`,
              borderLeft: `1px solid ${CALENDAR_LINE}`,
            }}
          >
            {Array.from({ length: weekCount }, (_, w) => {
              const weekCells = cells.slice(w * 7, w * 7 + 7);
              const weekSegments = packed.segments.filter((s) => s.week === w);
              return (
                <Box key={w} style={{ position: "relative" }}>
                  <SimpleGrid cols={7} spacing={0}>
                    {weekCells.map((date) => (
                      <DayCell
                        key={date.format(ISO)}
                        date={date}
                        inMonth={date.isSame(month, "month")}
                        onBarDrop={onBarDrop}
                        templates={templates}
                        onCreate={onCreate}
                      />
                    ))}
                  </SimpleGrid>
                  <WeekBars
                    segments={weekSegments}
                    overflow={packed.overflow.get(w) ?? 0}
                    weekBars={barsByWeek.get(w) ?? []}
                  />
                </Box>
              );
            })}
          </Box>
        </>
      )}
    </Stack>
  );
}

export default CalendarView;
