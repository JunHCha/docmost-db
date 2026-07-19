import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// The bar opens the row in the page-peek modal rather than navigating.
const peekOpen = vi.fn();
vi.mock(
  "@/features/database/components/relation-peek/use-page-peek.tsx",
  () => ({ usePagePeek: () => ({ open: peekOpen }) }),
);

const setMutate = vi.fn();
const createRowMutate = vi.fn();
// Mutable holder so a test can set the template list before rendering.
const templatesRef: { current: any[] } = { current: [] };
vi.mock("@/features/database/queries/database-query.ts", () => ({
  useSetValueMutation: () => ({ mutate: setMutate }),
  useCreateRowMutation: () => ({ mutate: createRowMutate }),
  useDatabaseTemplatesQuery: () => ({ data: templatesRef.current }),
}));

const patchRowValue = vi.fn();
vi.mock("@/features/database/queries/database-cache.ts", () => ({
  patchRowValue: (...args: unknown[]) => patchRowValue(...args),
}));

// pragmatic-drag-and-drop does not run in jsdom: stub draggable and capture each
// day cell's onDrop, keyed by the cell's ISO date, so a drop can be simulated.
const dropByDate = new Map<string, (arg: { source: { data: any } }) => void>();
vi.mock("@atlaskit/pragmatic-drag-and-drop/element/adapter", () => ({
  draggable: () => () => {},
  dropTargetForElements: (cfg: any) => {
    const iso = cfg.element.getAttribute("data-date");
    if (iso) dropByDate.set(iso, cfg.onDrop);
    return () => {};
  },
}));

import { CalendarView } from "./calendar-view";
import {
  IDatabaseProperty,
  IDatabaseRow,
  IDatabaseView,
} from "@/features/database/types/database.types.ts";

function dateProp(id: string, name: string): IDatabaseProperty {
  return {
    id,
    databaseId: "db1",
    name,
    type: "date",
    config: {},
    position: id,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };
}

function row(
  id: string,
  values: Array<{ propertyId: string; iso: string }>,
): IDatabaseRow {
  return {
    row: { id, title: id, slugId: id } as any,
    values: values.map((v) => ({
      id: `${id}-${v.propertyId}`,
      pageId: id,
      propertyId: v.propertyId,
      value: { type: "date", value: v.iso } as any,
      createdAt: new Date(),
      updatedAt: new Date(),
    })),
  };
}

function view(config: IDatabaseView["config"]): IDatabaseView {
  return {
    id: "v1",
    databaseId: "db1",
    name: "Calendar",
    type: "calendar",
    config,
    embedId: null,
    ownerUserId: null,
    isDefault: true,
    position: "a0",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

const properties = [dateProp("start", "Start"), dateProp("end", "End")];

function renderCalendar(opts: {
  config?: IDatabaseView["config"];
  rows?: IDatabaseRow[];
}) {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MantineProvider>
        <MemoryRouter>
          <CalendarView
            databaseId="db1"
            properties={properties}
            rows={opts.rows ?? []}
            activeView={view(opts.config ?? { datePropertyId: "start" })}
          />
        </MemoryRouter>
      </MantineProvider>
    </QueryClientProvider>,
  );
}

// A row-id shows one calendar-bar element per grid week it touches.
const barSegments = (rowId: string) =>
  screen
    .getAllByTestId("calendar-bar")
    .filter((el) => el.getAttribute("data-row-id") === rowId);

describe("CalendarView", () => {
  beforeEach(() => {
    // Anchor "now" to June 2026 so the default month is deterministic; the grid
    // then runs Sun 2026-05-31 .. Sat 2026-07-04.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T12:00:00Z"));
    dropByDate.clear();
    setMutate.mockReset();
    createRowMutate.mockReset();
    templatesRef.current = [];
    patchRowValue.mockReset();
    peekOpen.mockReset();
  });

  const cellFor = (iso: string) =>
    screen
      .getAllByTestId("calendar-day")
      .find((c) => c.getAttribute("data-date") === iso) as HTMLElement;

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders a single-day bar as one segment when no end date is set", () => {
    renderCalendar({
      config: { datePropertyId: "start" },
      rows: [row("r1", [{ propertyId: "start", iso: "2026-06-10" }])],
    });
    expect(barSegments("r1")).toHaveLength(1);
  });

  it("opens the row in the page-peek modal when a bar is clicked", () => {
    renderCalendar({
      config: { datePropertyId: "start" },
      rows: [row("r1", [{ propertyId: "start", iso: "2026-06-10" }])],
    });
    // The clickable zone is the bar's label (handles are drag-only).
    fireEvent.click(screen.getByText("r1"));
    expect(peekOpen).toHaveBeenCalledWith("r1", "modal");
  });

  it("splits a span crossing a week boundary into one segment per week", () => {
    renderCalendar({
      config: { datePropertyId: "start", endDatePropertyId: "end" },
      rows: [
        row("r1", [
          { propertyId: "start", iso: "2026-06-05" }, // Fri, week 0
          { propertyId: "end", iso: "2026-06-09" }, // Tue, week 1
        ]),
      ],
    });
    expect(barSegments("r1")).toHaveLength(2);
  });

  it("keeps a span within one week as a single segment", () => {
    renderCalendar({
      config: { datePropertyId: "start", endDatePropertyId: "end" },
      rows: [
        row("r1", [
          { propertyId: "start", iso: "2026-06-08" },
          { propertyId: "end", iso: "2026-06-10" },
        ]),
      ],
    });
    expect(barSegments("r1")).toHaveLength(1);
  });

  it("shifts both dates by the drop delta so the span moves whole", () => {
    renderCalendar({
      config: { datePropertyId: "start", endDatePropertyId: "end" },
      rows: [
        row("r1", [
          { propertyId: "start", iso: "2026-06-10" },
          { propertyId: "end", iso: "2026-06-12" },
        ]),
      ],
    });
    // Drop the bar onto 2026-06-15 (delta +5): start -> 06-15, end -> 06-17.
    dropByDate.get("2026-06-15")!({
      source: {
        data: {
          id: "r1",
          startDatePropertyId: "start",
          endDatePropertyId: "end",
          startISO: "2026-06-10",
          endISO: "2026-06-12",
        },
      },
    });
    expect(setMutate).toHaveBeenCalledWith({
      pageId: "r1",
      propertyId: "start",
      value: { type: "date", value: "2026-06-15" },
    });
    expect(setMutate).toHaveBeenCalledWith({
      pageId: "r1",
      propertyId: "end",
      value: { type: "date", value: "2026-06-17" },
    });
    expect(patchRowValue).toHaveBeenCalled();
  });

  it("moves a single-day bar's date on drop without touching an end property", () => {
    renderCalendar({
      config: { datePropertyId: "start" },
      rows: [row("r1", [{ propertyId: "start", iso: "2026-06-10" }])],
    });
    dropByDate.get("2026-06-20")!({
      source: {
        data: {
          id: "r1",
          startDatePropertyId: "start",
          endDatePropertyId: undefined,
          startISO: "2026-06-10",
          endISO: "2026-06-10",
        },
      },
    });
    expect(setMutate).toHaveBeenCalledTimes(1);
    expect(setMutate).toHaveBeenCalledWith({
      pageId: "r1",
      propertyId: "start",
      value: { type: "date", value: "2026-06-20" },
    });
  });

  const dragData = (over: Record<string, unknown> = {}) => ({
    source: {
      data: {
        id: "r1",
        startDatePropertyId: "start",
        endDatePropertyId: "end",
        startISO: "2026-06-10",
        endISO: "2026-06-12",
        ...over,
      },
    },
  });

  it("resizes only the end date when the right handle is dropped", () => {
    renderCalendar({
      config: { datePropertyId: "start", endDatePropertyId: "end" },
      rows: [
        row("r1", [
          { propertyId: "start", iso: "2026-06-10" },
          { propertyId: "end", iso: "2026-06-12" },
        ]),
      ],
    });
    dropByDate.get("2026-06-16")!(dragData({ mode: "resize-end" }));
    expect(setMutate).toHaveBeenCalledTimes(1);
    expect(setMutate).toHaveBeenCalledWith({
      pageId: "r1",
      propertyId: "end",
      value: { type: "date", value: "2026-06-16" },
    });
  });

  it("resizes only the start date when the left handle is dropped", () => {
    renderCalendar({
      config: { datePropertyId: "start", endDatePropertyId: "end" },
      rows: [
        row("r1", [
          { propertyId: "start", iso: "2026-06-10" },
          { propertyId: "end", iso: "2026-06-12" },
        ]),
      ],
    });
    dropByDate.get("2026-06-07")!(dragData({ mode: "resize-start" }));
    expect(setMutate).toHaveBeenCalledTimes(1);
    expect(setMutate).toHaveBeenCalledWith({
      pageId: "r1",
      propertyId: "start",
      value: { type: "date", value: "2026-06-07" },
    });
  });

  it("clamps a right-handle resize dropped before the start to the start day", () => {
    renderCalendar({
      config: { datePropertyId: "start", endDatePropertyId: "end" },
      rows: [
        row("r1", [
          { propertyId: "start", iso: "2026-06-10" },
          { propertyId: "end", iso: "2026-06-12" },
        ]),
      ],
    });
    dropByDate.get("2026-06-05")!(dragData({ mode: "resize-end" }));
    expect(setMutate).toHaveBeenCalledWith({
      pageId: "r1",
      propertyId: "end",
      value: { type: "date", value: "2026-06-10" },
    });
  });

  it("renders resize handles only on a multi-day bar's true ends", () => {
    renderCalendar({
      config: { datePropertyId: "start", endDatePropertyId: "end" },
      rows: [
        row("r1", [
          { propertyId: "start", iso: "2026-06-08" },
          { propertyId: "end", iso: "2026-06-10" },
        ]),
      ],
    });
    // One left + one right handle for a single-week span.
    expect(screen.getAllByTestId("calendar-bar-resize-start")).toHaveLength(1);
    expect(screen.getAllByTestId("calendar-bar-resize-end")).toHaveLength(1);
  });

  it("shows no resize handles on a single-day bar", () => {
    renderCalendar({
      config: { datePropertyId: "start" },
      rows: [row("r1", [{ propertyId: "start", iso: "2026-06-10" }])],
    });
    expect(screen.queryByTestId("calendar-bar-resize-start")).toBeNull();
    expect(screen.queryByTestId("calendar-bar-resize-end")).toBeNull();
  });

  it("creates a new page seeded with the cell's date from the + menu", () => {
    renderCalendar({ config: { datePropertyId: "start" } });
    fireEvent.click(within(cellFor("2026-06-10")).getByLabelText("Add"));
    fireEvent.click(screen.getByText("New page"));
    expect(createRowMutate).toHaveBeenCalledWith({
      databaseId: "db1",
      initialValues: { start: { type: "date", value: "2026-06-10" } },
    });
  });

  it("creates a row from a template seeded with the cell's date", () => {
    templatesRef.current = [{ id: "t1", name: "Bug", icon: null }];
    renderCalendar({ config: { datePropertyId: "start" } });
    fireEvent.click(within(cellFor("2026-06-15")).getByLabelText("Add"));
    fireEvent.click(screen.getByText("Bug"));
    expect(createRowMutate).toHaveBeenCalledWith({
      databaseId: "db1",
      templateId: "t1",
      initialValues: { start: { type: "date", value: "2026-06-15" } },
    });
  });

  it("shows the '+N more' overflow inside the cell that overflows", () => {
    // Four single-day bars on 2026-06-10 (max 3 lanes) → that cell hides one.
    renderCalendar({
      config: { datePropertyId: "start" },
      rows: ["a", "b", "c", "d"].map((id) =>
        row(id, [{ propertyId: "start", iso: "2026-06-10" }]),
      ),
    });
    const cell = cellFor("2026-06-10");
    const overflow = within(cell).getByTestId("calendar-overflow");
    expect(overflow.textContent).toContain("1");
    // A different day has no overflow indicator.
    expect(
      within(cellFor("2026-06-11")).queryByTestId("calendar-overflow"),
    ).toBeNull();
  });
});
