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
    isDefault: true,
    position: "a0",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function renderGrid(opts: { spaceSlug?: string; activeView?: IDatabaseView } = {}) {
  return render(
    <MantineProvider>
      <MemoryRouter>
        <TableView
          databaseId="db1"
          spaceId="space1"
          properties={properties}
          rows={rows}
          spaceSlug={opts.spaceSlug ?? "my-space"}
          activeView={opts.activeView ?? view({})}
        />
      </MemoryRouter>
    </MantineProvider>,
  );
}

describe("TableView", () => {
  beforeEach(() => {
    createRowMutate.mockReset();
    createPropertyMutate.mockReset();
    updateRowTitleMutate.mockReset();
    navigate.mockReset();
  });

  it("renders a header per property", () => {
    renderGrid();
    expect(screen.getByText("Status")).toBeTruthy();
    expect(screen.getByText("Done")).toBeTruthy();
  });

  it("renders a leading Title column header", () => {
    renderGrid();
    expect(screen.getByText("Title")).toBeTruthy();
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
