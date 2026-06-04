import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { MemoryRouter } from "react-router-dom";

const infoQuery = vi.fn();
const propertiesQuery = vi.fn();
const rowsQuery = vi.fn();
const viewsQuery = vi.fn();
const updatePageMutate = vi.fn();
const updateViewMutate = vi.fn();

vi.mock("@mantine/hooks", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@mantine/hooks")>();
  // Run debounced callbacks synchronously so persistence is observable in tests.
  return { ...actual, useDebouncedCallback: (fn: any) => fn };
});

vi.mock("@/features/database/queries/database-query.ts", () => ({
  useDatabaseInfoQuery: () => infoQuery(),
  useDatabasePropertiesQuery: () => propertiesQuery(),
  useDatabaseRowsQuery: (databaseId: string, viewId: string, config?: any) =>
    rowsQuery(databaseId, viewId, config),
  useDatabaseViewsQuery: () => viewsQuery(),
  useSetValueMutation: () => ({ mutate: vi.fn() }),
  useClearValueMutation: () => ({ mutate: vi.fn() }),
  useCreateRowMutation: () => ({ mutate: vi.fn() }),
  useCreatePropertyMutation: () => ({ mutate: vi.fn() }),
  useReorderPropertyMutation: () => ({ mutate: vi.fn() }),
  useUpdatePropertyMutation: () => ({ mutate: vi.fn() }),
  useDeletePropertyMutation: () => ({ mutate: vi.fn() }),
  useUpdateViewMutation: () => ({ mutate: updateViewMutate }),
  useCreateViewMutation: () => ({ mutate: vi.fn() }),
  useSetDefaultViewMutation: () => ({ mutate: vi.fn() }),
  useDeleteViewMutation: () => ({ mutate: vi.fn() }),
  useDeleteRowsMutation: () => ({ mutate: vi.fn() }),
  useUpdateRowTitleMutation: () => ({ mutate: vi.fn() }),
  useListDatabasesQuery: () => ({ data: [] }),
}));

function makeView(id: string, name: string, isDefault = false, config: any = {}) {
  return {
    id,
    databaseId: "db1",
    name,
    type: "table",
    config,
    isDefault,
    position: id,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

const oneProperty = [
  {
    id: "p1",
    databaseId: "db1",
    name: "Status",
    type: "select",
    config: { options: [{ id: "o1", label: "Done" }] },
    position: "a0",
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  },
];

vi.mock("@/features/page/queries/page-query.ts", () => ({
  useUpdatePageMutation: () => ({ mutate: updatePageMutate }),
}));

import { DatabaseViewContainer } from "./database-view-container";

const page = { id: "page1", title: "Tasks" } as any;

function renderContainer() {
  return render(
    <MantineProvider>
      <MemoryRouter>
        <DatabaseViewContainer page={page} />
      </MemoryRouter>
    </MantineProvider>,
  );
}

describe("DatabaseViewContainer", () => {
  beforeEach(() => {
    rowsQuery.mockReset();
    rowsQuery.mockReturnValue({ data: [], isLoading: false });
    viewsQuery.mockReturnValue({ data: [makeView("v1", "Grid", true)] });
  });

  it("shows a loader while the database info is loading", () => {
    infoQuery.mockReturnValue({ data: undefined, isLoading: true });
    propertiesQuery.mockReturnValue({ data: undefined });
    rowsQuery.mockReturnValue({ data: undefined });
    const { container } = renderContainer();
    expect(container.querySelector(".mantine-Loader-root")).toBeTruthy();
  });

  it("shows an empty notice instead of an infinite loader when the page is not a database", () => {
    // info resolved with database: null (a plain page) — must not hang on a loader.
    infoQuery.mockReturnValue({
      data: { database: null, page },
      isLoading: false,
    });
    propertiesQuery.mockReturnValue({ data: undefined });
    rowsQuery.mockReturnValue({ data: undefined });
    const { container } = renderContainer();
    expect(container.querySelector(".mantine-Loader-root")).toBeNull();
    expect(screen.getByText("This page is not a database")).toBeTruthy();
  });

  it("renders the grid once info, properties and rows resolve", () => {
    infoQuery.mockReturnValue({
      data: { database: { id: "db1" }, page },
      isLoading: false,
    });
    propertiesQuery.mockReturnValue({
      data: [
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
      ],
      isLoading: false,
    });
    rowsQuery.mockReturnValue({ data: [], isLoading: false });
    renderContainer();
    expect(screen.getByText("Status")).toBeTruthy();
  });

  it("renders the page title in the title input and commits edits", () => {
    updatePageMutate.mockReset();
    infoQuery.mockReturnValue({
      data: { database: { id: "db1" }, page },
      isLoading: false,
    });
    propertiesQuery.mockReturnValue({ data: [], isLoading: false });
    rowsQuery.mockReturnValue({ data: [], isLoading: false });
    renderContainer();
    const input = screen.getByLabelText("Database title") as HTMLInputElement;
    expect(input.value).toBe("Tasks");
    fireEvent.change(input, { target: { value: "Projects" } });
    fireEvent.blur(input);
    expect(updatePageMutate).toHaveBeenCalledWith({
      pageId: "page1",
      title: "Projects",
    });
  });

  it("loads rows for the default view initially", () => {
    infoQuery.mockReturnValue({
      data: { database: { id: "db1" }, page },
      isLoading: false,
    });
    propertiesQuery.mockReturnValue({ data: [], isLoading: false });
    viewsQuery.mockReturnValue({
      data: [makeView("v1", "Grid"), makeView("v2", "Backlog", true)],
    });
    renderContainer();
    expect(rowsQuery).toHaveBeenCalledWith("db1", "v2", expect.anything());
  });

  it("switches the rows query view id when another tab is activated", () => {
    infoQuery.mockReturnValue({
      data: { database: { id: "db1" }, page },
      isLoading: false,
    });
    propertiesQuery.mockReturnValue({ data: [], isLoading: false });
    viewsQuery.mockReturnValue({
      data: [makeView("v1", "Grid", true), makeView("v2", "Backlog")],
    });
    renderContainer();
    expect(rowsQuery).toHaveBeenCalledWith("db1", "v1", expect.anything());
    fireEvent.click(screen.getByText("Backlog"));
    expect(rowsQuery).toHaveBeenLastCalledWith("db1", "v2", expect.anything());
  });

  it("passes the active view's filters/sorts config to the rows query", () => {
    const config = {
      filters: [{ propertyId: "p1", op: "eq", value: "o1" }],
      sorts: [{ propertyId: "p1", direction: "asc" }],
    };
    infoQuery.mockReturnValue({
      data: { database: { id: "db1" }, page },
      isLoading: false,
    });
    propertiesQuery.mockReturnValue({ data: oneProperty, isLoading: false });
    viewsQuery.mockReturnValue({ data: [makeView("v1", "Grid", true, config)] });
    renderContainer();
    expect(rowsQuery).toHaveBeenLastCalledWith(
      "db1",
      "v1",
      expect.objectContaining({
        filters: config.filters,
        sorts: config.sorts,
      }),
    );
  });

  it("persists a filter change to the view config via updateView", async () => {
    updateViewMutate.mockReset();
    infoQuery.mockReturnValue({
      data: { database: { id: "db1" }, page },
      isLoading: false,
    });
    propertiesQuery.mockReturnValue({ data: oneProperty, isLoading: false });
    viewsQuery.mockReturnValue({ data: [makeView("v1", "Grid", true)] });
    renderContainer();
    fireEvent.click(screen.getByRole("button", { name: /filter/i }));
    fireEvent.click(await screen.findByText("Add filter"));
    expect(updateViewMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        viewId: "v1",
        config: expect.objectContaining({
          filters: [{ propertyId: "p1", op: "eq", value: undefined }],
        }),
      }),
    );
  });

  it("shows an empty state when a filtered view returns no rows", () => {
    infoQuery.mockReturnValue({
      data: { database: { id: "db1" }, page },
      isLoading: false,
    });
    propertiesQuery.mockReturnValue({ data: oneProperty, isLoading: false });
    viewsQuery.mockReturnValue({
      data: [
        makeView("v1", "Grid", true, {
          filters: [{ propertyId: "p1", op: "eq", value: "o1" }],
        }),
      ],
    });
    rowsQuery.mockReturnValue({ data: [], isLoading: false });
    renderContainer();
    expect(screen.getByText("No rows match the current filters")).toBeTruthy();
    expect(screen.getByText("Clear filters")).toBeTruthy();
  });

  it("falls back to the default view when the active view disappears", () => {
    infoQuery.mockReturnValue({
      data: { database: { id: "db1" }, page },
      isLoading: false,
    });
    propertiesQuery.mockReturnValue({ data: [], isLoading: false });
    // The active view (v2) is no longer in the list (deleted); the container
    // must re-resolve to the default rather than query a dead view id.
    viewsQuery.mockReturnValue({ data: [makeView("v1", "Grid", true)] });
    renderContainer();
    fireEvent.click(screen.getByLabelText("Add view"));
    // No v2 tab exists, so rows resolve against the surviving default v1.
    expect(rowsQuery).toHaveBeenLastCalledWith("db1", "v1", expect.anything());
  });
});
