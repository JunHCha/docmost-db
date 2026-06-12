import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { MemoryRouter } from "react-router-dom";

const {
  infoQuery,
  propertiesQuery,
  rowsQuery,
  viewsQuery,
  updatePageMutate,
  updatePageMutateAsync,
  updateViewMutate,
  localEmitterEmit,
  queryEmit,
  databaseCollab,
} = vi.hoisted(() => ({
  infoQuery: vi.fn(),
  propertiesQuery: vi.fn(),
  rowsQuery: vi.fn(),
  viewsQuery: vi.fn(),
  updatePageMutate: vi.fn(),
  updatePageMutateAsync: vi.fn(),
  updateViewMutate: vi.fn(),
  localEmitterEmit: vi.fn(),
  queryEmit: vi.fn(),
  databaseCollab: vi.fn(),
}));

// The collab hook opens a real Hocuspocus websocket; stub it and just record
// the page id it is asked to connect with.
vi.mock("../hooks/use-database-collab", () => ({
  useDatabaseCollab: (dbPageId: string) => {
    databaseCollab(dbPageId);
    return {
      provider: null,
      onlineUsers: [],
      editingByCell: {},
      setEditingCell: () => {},
    };
  },
}));

// Phase 2 realtime hook needs a QueryClient and a real provider; stub it and
// just hand back a no-op broadcaster so the container renders standalone.
vi.mock("../hooks/use-database-realtime", () => ({
  useDatabaseRealtime: () => ({ broadcastChange: () => {} }),
}));

vi.mock("@/lib/local-emitter.ts", () => ({
  default: { emit: localEmitterEmit },
}));

vi.mock("@/features/websocket/use-query-emit.ts", () => ({
  useQueryEmit: () => queryEmit,
}));

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
  useUpdatePageMutation: () => ({
    mutate: updatePageMutate,
    mutateAsync: updatePageMutateAsync,
  }),
}));

// Stub the heavy view bodies (they pull in their own query-client hooks); the
// container tests only care about which branch renders.
vi.mock("./table-view/table-view", () => ({
  TableView: ({ properties }: { properties: { name: string }[] }) => (
    <div data-testid="table-view">{properties.map((p) => p.name).join(",")}</div>
  ),
}));
vi.mock("./board-view/board-view", () => ({
  BoardView: () => <div data-testid="board-view" />,
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
    databaseCollab.mockReset();
    rowsQuery.mockReset();
    rowsQuery.mockReturnValue({ data: [], isLoading: false });
    viewsQuery.mockReturnValue({ data: [makeView("v1", "Grid", true)] });
    // Provide a safe default so commitTitle doesn't throw in tests that don't
    // care about the mutation result.
    updatePageMutateAsync.mockResolvedValue({
      id: "page1",
      title: "Tasks",
      slugId: "slug1",
      parentPageId: null,
      icon: null,
      spaceId: "space1",
    });
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

  it("opens the DB collab channel with the page id once it resolves to a database", () => {
    infoQuery.mockReturnValue({
      data: { database: { id: "db1" }, page },
      isLoading: false,
    });
    propertiesQuery.mockReturnValue({ data: [], isLoading: false });
    renderContainer();
    expect(databaseCollab).toHaveBeenLastCalledWith("page1");
  });

  it("does not open the collab channel for a plain (non-database) page", () => {
    infoQuery.mockReturnValue({
      data: { database: null, page },
      isLoading: false,
    });
    propertiesQuery.mockReturnValue({ data: undefined });
    rowsQuery.mockReturnValue({ data: undefined });
    renderContainer();
    expect(databaseCollab).toHaveBeenLastCalledWith("");
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
    updatePageMutateAsync.mockReset();
    updatePageMutateAsync.mockResolvedValue({
      id: "page1",
      title: "Projects",
      slugId: "slug1",
      parentPageId: null,
      icon: null,
      spaceId: "space1",
    });
    infoQuery.mockReturnValue({
      data: { database: { id: "db1", spaceId: "space1" }, page },
      isLoading: false,
    });
    propertiesQuery.mockReturnValue({ data: [], isLoading: false });
    rowsQuery.mockReturnValue({ data: [], isLoading: false });
    renderContainer();
    const input = screen.getByLabelText("Database title") as HTMLInputElement;
    expect(input.value).toBe("Tasks");
    fireEvent.change(input, { target: { value: "Projects" } });
    fireEvent.blur(input);
    expect(updatePageMutateAsync).toHaveBeenCalledWith({
      pageId: "page1",
      title: "Projects",
    });
  });

  it("emits a localEmitter updateOne event after a title change is saved", async () => {
    localEmitterEmit.mockReset();
    queryEmit.mockReset();
    const updatedPage = {
      id: "page1",
      title: "Projects",
      slugId: "slug1",
      parentPageId: null,
      icon: null,
      spaceId: "space1",
    };
    updatePageMutateAsync.mockResolvedValue(updatedPage);
    infoQuery.mockReturnValue({
      data: { database: { id: "db1", spaceId: "space1" }, page },
      isLoading: false,
    });
    propertiesQuery.mockReturnValue({ data: [], isLoading: false });
    rowsQuery.mockReturnValue({ data: [], isLoading: false });
    renderContainer();
    const input = screen.getByLabelText("Database title") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Projects" } });
    fireEvent.blur(input);
    // wait for the async mutateAsync promise to resolve
    await vi.waitFor(() => expect(localEmitterEmit).toHaveBeenCalled());
    expect(localEmitterEmit).toHaveBeenCalledWith(
      "message",
      expect.objectContaining({
        operation: "updateOne",
        entity: ["pages"],
        payload: expect.objectContaining({ title: "Projects" }),
      }),
    );
    expect(queryEmit).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: "updateOne",
        entity: ["pages"],
        payload: expect.objectContaining({ title: "Projects" }),
      }),
    );
  });

  it("does not emit localEmitter when title is unchanged", async () => {
    localEmitterEmit.mockReset();
    updatePageMutateAsync.mockReset();
    infoQuery.mockReturnValue({
      data: { database: { id: "db1", spaceId: "space1" }, page },
      isLoading: false,
    });
    propertiesQuery.mockReturnValue({ data: [], isLoading: false });
    rowsQuery.mockReturnValue({ data: [], isLoading: false });
    renderContainer();
    const input = screen.getByLabelText("Database title") as HTMLInputElement;
    // blur without changing the value
    fireEvent.blur(input);
    expect(updatePageMutateAsync).not.toHaveBeenCalled();
    expect(localEmitterEmit).not.toHaveBeenCalled();
  });

  it("does not emit localEmitter when the new title is blank/whitespace", async () => {
    localEmitterEmit.mockReset();
    updatePageMutateAsync.mockReset();
    infoQuery.mockReturnValue({
      data: { database: { id: "db1", spaceId: "space1" }, page },
      isLoading: false,
    });
    propertiesQuery.mockReturnValue({ data: [], isLoading: false });
    rowsQuery.mockReturnValue({ data: [], isLoading: false });
    renderContainer();
    const input = screen.getByLabelText("Database title") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.blur(input);
    expect(updatePageMutateAsync).not.toHaveBeenCalled();
    expect(localEmitterEmit).not.toHaveBeenCalled();
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

  it("renders the board (not the filtered-empty notice) for a board view with no rows", () => {
    infoQuery.mockReturnValue({
      data: { database: { id: "db1" }, page },
      isLoading: false,
    });
    propertiesQuery.mockReturnValue({ data: oneProperty, isLoading: false });
    viewsQuery.mockReturnValue({
      data: [
        {
          ...makeView("v1", "Board", true, {
            filters: [{ propertyId: "p1", op: "eq", value: "o1" }],
            groupByPropertyId: "p1",
          }),
          type: "board",
        },
      ],
    });
    rowsQuery.mockReturnValue({ data: [], isLoading: false });
    renderContainer();
    // The board view must render, not the table-only empty notice.
    expect(screen.getByTestId("board-view")).toBeTruthy();
    expect(screen.queryByText("No rows match the current filters")).toBeNull();
  });

  it("does not flash the filtered-empty notice while rows are loading", () => {
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
    // Rows still loading -> container shows its loader, never the empty notice.
    rowsQuery.mockReturnValue({ data: undefined, isLoading: true });
    renderContainer();
    expect(screen.queryByText("No rows match the current filters")).toBeNull();
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
