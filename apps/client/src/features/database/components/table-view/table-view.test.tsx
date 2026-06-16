import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { MemoryRouter } from "react-router-dom";

const navigate = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => navigate };
});

const setMutate = vi.fn();
const clearMutate = vi.fn();
const createRowMutate = vi.fn();
const createPropertyMutate = vi.fn();
const updateRowTitleMutate = vi.fn();
const updateViewMutate = vi.fn();
const deleteRowsMutate = vi.fn();

vi.mock("@/features/database/queries/database-query.ts", () => ({
  useSetValueMutation: () => ({ mutate: setMutate }),
  useClearValueMutation: () => ({ mutate: clearMutate }),
  useCreateRowMutation: () => ({ mutate: createRowMutate }),
  useCreatePropertyMutation: () => ({ mutate: createPropertyMutate }),
  useReorderPropertyMutation: () => ({ mutate: vi.fn() }),
  useUpdatePropertyMutation: () => ({ mutate: vi.fn() }),
  useDeletePropertyMutation: () => ({ mutate: vi.fn() }),
  useUpdateViewMutation: () => ({ mutate: updateViewMutate }),
  useUpdateRowTitleMutation: () => ({ mutate: updateRowTitleMutate }),
  useDeleteRowsMutation: () => ({ mutate: deleteRowsMutate }),
  useListDatabasesQuery: () => ({ data: [] }),
  useDatabaseRowsQuery: () => ({ data: [] }),
}));

import { TableView } from "./table-view";
import {
  IDatabaseProperty,
  IDatabaseRow,
  IDatabaseView,
} from "@/features/database/types/database.types.ts";

const properties: IDatabaseProperty[] = [
  {
    id: "p1",
    databaseId: "db1",
    name: "Status",
    type: "text",
    config: {},
    position: "a0",
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  },
  {
    id: "p2",
    databaseId: "db1",
    name: "Done",
    type: "checkbox",
    config: {},
    position: "a1",
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  },
];

const rows: IDatabaseRow[] = [
  {
    row: { id: "row1", title: "First", slugId: "slug1" } as any,
    values: [
      {
        id: "v1",
        pageId: "row1",
        propertyId: "p1",
        value: { type: "text", value: "Hello" },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
  },
];

function view(config: IDatabaseView["config"]): IDatabaseView {
  return {
    id: "v1",
    databaseId: "db1",
    name: "Table",
    type: "table",
    config,
    embedId: null,
    ownerUserId: null,
    isDefault: true,
    position: "a0",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function renderGrid(
  opts: {
    spaceSlug?: string;
    activeView?: IDatabaseView;
    rows?: IDatabaseRow[];
  } = {},
) {
  return render(
    <MantineProvider>
      <MemoryRouter>
        <TableView
          databaseId="db1"
          spaceId="space1"
          properties={properties}
          rows={opts.rows ?? rows}
          spaceSlug={opts.spaceSlug ?? "my-space"}
          activeView={opts.activeView ?? view({})}
        />
      </MemoryRouter>
    </MantineProvider>,
  );
}

function makeRow(id: string, title: string): IDatabaseRow {
  return {
    row: { id, title, slugId: `slug-${id}` } as any,
    values: [],
  };
}

describe("TableView", () => {
  beforeEach(() => {
    createRowMutate.mockReset();
    createPropertyMutate.mockReset();
    updateRowTitleMutate.mockReset();
    updateViewMutate.mockReset();
    navigate.mockReset();
  });

  it("renders a header per property", () => {
    renderGrid();
    expect(screen.getByText("Status")).toBeTruthy();
    expect(screen.getByText("Done")).toBeTruthy();
  });

  it("persists a resized Title column width on the view config", () => {
    renderGrid();
    const titleTh = screen.getByText("Title").closest("th") as HTMLElement;
    const handle = within(titleTh).getByLabelText("Resize column");
    // jsdom has no PointerCapture API — stub it like column-header.test.
    (handle as any).setPointerCapture = vi.fn();
    // jsdom drops clientX on synthetic pointer events, so dispatch MouseEvents
    // (which carry clientX) under the pointer event type names — mirrors
    // column-header.test.
    const pointer = (type: string, clientX: number) =>
      fireEvent(handle, new MouseEvent(type, { bubbles: true, clientX }));
    pointer("pointerdown", 100);
    pointer("pointermove", 180);
    expect(updateViewMutate).not.toHaveBeenCalled();
    pointer("pointerup", 180);
    // Default title width 220 + (180 - 100) = 300.
    expect(updateViewMutate).toHaveBeenCalledWith({
      viewId: "v1",
      config: expect.objectContaining({ titleWidth: 300 }),
    });
  });

  it("applies the configured Title width to the Title header", () => {
    renderGrid({ activeView: view({ titleWidth: 280 }) });
    const titleTh = screen.getByText("Title").closest("th") as HTMLElement;
    expect(titleTh.style.width).toBe("280px");
  });

  it("renders a leading Title column header", () => {
    renderGrid();
    expect(screen.getByText("Title")).toBeTruthy();
  });

  it("anchors each resizable column's handle to the cell border (Th is the positioned context)", () => {
    // The resize handle is absolutely positioned at right:-3px; its border must
    // be the th itself, not the padded content box, or the handle/hover rule
    // floats inside the cell instead of on the column divider (issue #15).
    renderGrid();
    const handles = screen.getAllByLabelText("Resize column");
    expect(handles.length).toBeGreaterThan(0);
    for (const handle of handles) {
      const th = handle.closest("th") as HTMLElement;
      expect(th).toBeTruthy();
      // The handle's nearest positioned ancestor must be the th (so right:-3px
      // lands on the th's right border). We mark that th with a known class that
      // sets position:relative and zeroes the cell padding.
      expect(th.className).toContain("headerCell");
      // No intermediate position:relative wrapper between handle and th.
      let el: HTMLElement | null = handle.parentElement;
      while (el && el !== th) {
        expect(el.style.position).not.toBe("relative");
        el = el.parentElement;
      }
    }
  });

  it("scrolls horizontally instead of squeezing columns when they overflow", () => {
    // Wide databases should scroll sideways; the column-config dropdown opens
    // in a portal (see column-header) so it is not clipped by this container.
    renderGrid();
    const container = screen.getByTestId("table-view");
    expect(container.style.overflowX).toBe("auto");
  });

  it("renders each row's page title in the Title column", () => {
    renderGrid();
    expect(screen.getByText("First")).toBeTruthy();
  });

  it("commits an edited row title through useUpdateRowTitleMutation", () => {
    renderGrid();
    fireEvent.click(screen.getByText("First"));
    const input = screen.getByLabelText("Row title") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Second" } });
    fireEvent.blur(input);
    expect(updateRowTitleMutate).toHaveBeenCalledWith({
      pageId: "row1",
      title: "Second",
    });
  });

  it("navigates to the row page when the open trigger is clicked", () => {
    renderGrid();
    fireEvent.click(screen.getByLabelText("Open row"));
    expect(navigate).toHaveBeenCalledWith("/s/my-space/p/first-slug1");
  });

  it("does not navigate when the title text is clicked (edits instead)", () => {
    renderGrid();
    fireEvent.click(screen.getByText("First"));
    expect(navigate).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Row title")).toBeTruthy();
  });

  it("renders each row's cell values", () => {
    renderGrid();
    expect(screen.getByText("Hello")).toBeTruthy();
  });

  it("creates a row when the add-row button is clicked", () => {
    renderGrid();
    fireEvent.click(screen.getByText("+ Row"));
    expect(createRowMutate).toHaveBeenCalledWith({ databaseId: "db1" });
  });

  it("creates a text column when the add-column button is clicked", () => {
    renderGrid();
    fireEvent.click(screen.getByLabelText("Add column"));
    expect(createPropertyMutate).toHaveBeenCalledWith({
      databaseId: "db1",
      name: "New column",
      type: "text",
    });
  });
});

describe("TableView active-view column config", () => {
  beforeEach(() => updateViewMutate.mockReset());

  it("hides a column whose view config marks it not visible", () => {
    renderGrid({ activeView: view({ columns: [{ propertyId: "p1", visible: false }] }) });
    expect(screen.queryByText("Status")).toBeNull();
    expect(screen.getByText("Done")).toBeTruthy();
  });

  it("orders columns by the view config order", () => {
    renderGrid({
      activeView: view({
        columns: [
          { propertyId: "p2", visible: true },
          { propertyId: "p1", visible: true },
        ],
      }),
    });
    const headers = screen
      .getAllByRole("columnheader")
      .map((h) => h.textContent ?? "");
    const doneIdx = headers.findIndex((t) => t.includes("Done"));
    const statusIdx = headers.findIndex((t) => t.includes("Status"));
    expect(doneIdx).toBeLessThan(statusIdx);
  });

  it("applies the configured width to the column header", () => {
    renderGrid({
      activeView: view({ columns: [{ propertyId: "p1", visible: true, width: 320 }] }),
    });
    const statusHeader = screen
      .getAllByRole("columnheader")
      .find((h) => h.textContent?.includes("Status")) as HTMLElement;
    expect(statusHeader.style.width).toBe("320px");
  });

  it("uses a fixed table layout with explicit column widths so edit mode can't reflow", () => {
    const { container } = renderGrid({
      activeView: view({ columns: [{ propertyId: "p1", visible: true, width: 240 }] }),
    });
    const table = container.querySelector("table") as HTMLTableElement;
    expect(table.style.tableLayout).toBe("fixed");
    const before = (
      screen
        .getAllByRole("columnheader")
        .find((h) => h.textContent?.includes("Status")) as HTMLElement
    ).style.width;
    // Enter edit mode on a Name cell — the width must not change.
    fireEvent.click(screen.getByText("First"));
    expect(screen.getByLabelText("Row title")).toBeTruthy();
    const after = (
      screen
        .getAllByRole("columnheader")
        .find((h) => h.textContent?.includes("Status")) as HTMLElement
    ).style.width;
    expect(after).toBe(before);
    expect(after).toBe("240px");
  });

  it("commits a hide toggle as a full echoed columns array via updateView", () => {
    renderGrid();
    // The hide action lives in the Status column's options menu.
    const statusHeader = screen
      .getAllByRole("columnheader")
      .find((h) => h.textContent?.includes("Status")) as HTMLElement;
    fireEvent.click(within(statusHeader).getByLabelText("Column options"));
    fireEvent.click(screen.getByText("Hide column"));
    expect(updateViewMutate).toHaveBeenCalledWith({
      viewId: "v1",
      config: {
        columns: [
          { propertyId: "p1", visible: false },
          { propertyId: "p2", visible: true },
        ],
      },
    });
  });
});

describe("TableView row multi-select", () => {
  beforeEach(() => {
    deleteRowsMutate.mockReset();
    navigate.mockReset();
  });

  const threeRows = [
    makeRow("r1", "Alpha"),
    makeRow("r2", "Beta"),
    makeRow("r3", "Gamma"),
  ];

  it("renders a header select-all checkbox in the gutter", () => {
    renderGrid({ rows: threeRows });
    expect(screen.getByLabelText("Select all rows")).toBeTruthy();
  });

  it("renders a select checkbox per row", () => {
    renderGrid({ rows: threeRows });
    expect(screen.getAllByLabelText("Select row")).toHaveLength(3);
  });

  it("selects all visible rows via the header checkbox", () => {
    renderGrid({ rows: threeRows });
    fireEvent.click(screen.getByLabelText("Select all rows"));
    expect(screen.getByText(/3\s+selected/)).toBeTruthy();
  });

  it("shows the action bar once a row is selected", () => {
    renderGrid({ rows: threeRows });
    expect(screen.queryByLabelText("Delete selected rows")).toBeNull();
    fireEvent.click(screen.getAllByLabelText("Select row")[0]);
    expect(screen.getByLabelText("Delete selected rows")).toBeTruthy();
    expect(screen.getByText(/1\s+selected/)).toBeTruthy();
  });

  it("bulk-deletes the selected pageIds via useDeleteRowsMutation", () => {
    renderGrid({ rows: threeRows });
    fireEvent.click(screen.getByLabelText("Select all rows"));
    fireEvent.click(screen.getByLabelText("Delete selected rows"));
    expect(deleteRowsMutate).toHaveBeenCalledWith(
      { databaseId: "db1", pageIds: ["r1", "r2", "r3"] },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it("selects a shift-range in visible order", () => {
    renderGrid({ rows: threeRows });
    const boxes = screen.getAllByLabelText("Select row");
    fireEvent.click(boxes[0]);
    fireEvent.click(boxes[2], { shiftKey: true });
    expect(screen.getByText(/3\s+selected/)).toBeTruthy();
  });

  it("does not navigate when a row checkbox is clicked", () => {
    renderGrid({ rows: threeRows });
    fireEvent.click(screen.getAllByLabelText("Select row")[0]);
    expect(navigate).not.toHaveBeenCalled();
  });

  it("keeps the +Row footer spanning gutter, columns and add-column", () => {
    const { container } = renderGrid({ rows: threeRows });
    const footerCell = container.querySelector(
      "tbody tr:last-child td[colspan]",
    ) as HTMLTableCellElement;
    // gutter + title + 2 properties + add-column = 5 (columns.length + 3)
    expect(footerCell.getAttribute("colspan")).toBe("5");
  });
});
