import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";

const propertiesQuery = vi.fn();
const rowsQuery = vi.fn();
const viewsQuery = vi.fn();
const updateViewMutate = vi.fn();

vi.mock("@mantine/hooks", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@mantine/hooks")>();
  // Run debounced callbacks synchronously so persistence is observable in tests.
  return { ...actual, useDebouncedCallback: (fn: any) => fn };
});

vi.mock("@/features/database/queries/database-query.ts", () => ({
  useDatabasePropertiesQuery: () => propertiesQuery(),
  useDatabaseRowsQuery: (databaseId: string, viewId: string, config?: any) =>
    rowsQuery(databaseId, viewId, config),
  useDatabaseViewsQuery: (databaseId: string, embedId?: string) =>
    viewsQuery(databaseId, embedId),
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
}));

function makeView(
  id: string,
  name: string,
  isDefault = false,
  config: any = {},
) {
  return {
    id,
    databaseId: "db1",
    name,
    type: "table",
    config,
    isDefault,
    position: id,
    embedId: null,
    ownerUserId: null,
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

// Stub the heavy view bodies; these tests only care about which branch renders
// and which props reach the body.
vi.mock("./table-view/table-view", () => ({
  TableView: ({
    properties,
    spaceId,
    spaceSlug,
  }: {
    properties: { name: string }[];
    spaceId: string;
    spaceSlug?: string;
  }) => (
    <div
      data-testid="table-view"
      data-space-id={spaceId}
      data-space-slug={spaceSlug}
    >
      {properties.map((p) => p.name).join(",")}
    </div>
  ),
}));
vi.mock("./board-view/board-view", () => ({
  BoardView: () => <div data-testid="board-view" />,
}));
// Expose the toolbar's filter/sort change callbacks as buttons so a test can
// trigger a config change and assert on the persist behaviour.
vi.mock("./toolbar/view-toolbar", () => ({
  ViewToolbar: ({
    onFiltersChange,
    onSortsChange,
  }: {
    onFiltersChange: (f: any) => void;
    onSortsChange: (s: any) => void;
  }) => (
    <div>
      <button
        data-testid="change-filters"
        onClick={() =>
          onFiltersChange([{ propertyId: "p1", op: "eq", value: "o1" }])
        }
      />
      <button
        data-testid="change-sorts"
        onClick={() =>
          onSortsChange([{ propertyId: "p1", direction: "asc" }])
        }
      />
    </div>
  ),
}));

import { DatabaseView } from "./database-view";

// Note: no MemoryRouter — DatabaseView must mount without any route context,
// which is exactly what the inline embed (issue #24) needs.
function renderView(
  props: Partial<{
    databaseId: string;
    spaceId: string;
    spaceSlug?: string;
    initialViewId?: string;
    embedId?: string;
  }> = {},
) {
  return render(
    <MantineProvider>
      <DatabaseView
        databaseId={props.databaseId ?? "db1"}
        spaceId={props.spaceId ?? "space1"}
        spaceSlug={props.spaceSlug}
        initialViewId={props.initialViewId}
        embedId={props.embedId}
      />
    </MantineProvider>,
  );
}

describe("DatabaseView", () => {
  beforeEach(() => {
    rowsQuery.mockReset();
    updateViewMutate.mockReset();
    rowsQuery.mockReturnValue({ data: [], isLoading: false });
    viewsQuery.mockReturnValue({ data: [makeView("v1", "Grid", true)] });
    propertiesQuery.mockReturnValue({ data: [], isLoading: false });
  });

  it("mounts from raw ids — no page, no title input, no route", () => {
    propertiesQuery.mockReturnValue({ data: oneProperty, isLoading: false });
    renderView();
    expect(screen.getByTestId("table-view")).toBeTruthy();
    // The page-only title editor lives in DatabaseViewContainer, not here.
    expect(screen.queryByLabelText("Database title")).toBeNull();
  });

  it("forwards spaceId and spaceSlug straight through to the body", () => {
    propertiesQuery.mockReturnValue({ data: oneProperty, isLoading: false });
    renderView({ spaceId: "space-x", spaceSlug: "team-x" });
    const body = screen.getByTestId("table-view");
    expect(body.getAttribute("data-space-id")).toBe("space-x");
    expect(body.getAttribute("data-space-slug")).toBe("team-x");
  });

  it("shows a loader until properties, rows and the active view resolve", () => {
    propertiesQuery.mockReturnValue({ data: undefined, isLoading: true });
    rowsQuery.mockReturnValue({ data: undefined, isLoading: true });
    const { container } = renderView();
    expect(container.querySelector(".mantine-Loader-root")).toBeTruthy();
  });

  it("loads rows for the default view initially", () => {
    viewsQuery.mockReturnValue({
      data: [makeView("v1", "Grid"), makeView("v2", "Backlog", true)],
    });
    renderView();
    expect(rowsQuery).toHaveBeenCalledWith("db1", "v2", expect.anything());
  });

  it("switches the rows query view id when another tab is activated", () => {
    viewsQuery.mockReturnValue({
      data: [makeView("v1", "Grid", true), makeView("v2", "Backlog")],
    });
    renderView();
    expect(rowsQuery).toHaveBeenCalledWith("db1", "v1", expect.anything());
    fireEvent.click(screen.getByText("Backlog"));
    expect(rowsQuery).toHaveBeenLastCalledWith("db1", "v2", expect.anything());
  });

  it("persists filter/sort changes by default", () => {
    renderView();
    fireEvent.click(screen.getByTestId("change-filters"));
    expect(updateViewMutate).toHaveBeenCalled();
  });

  it("activates initialViewId rather than the default when given", () => {
    viewsQuery.mockReturnValue({
      data: [makeView("v1", "Grid", true), makeView("v2", "Backlog")],
    });
    renderView({ initialViewId: "v2" });
    // v1 is the default, but the embed pins v2 — rows must load for v2.
    expect(rowsQuery).toHaveBeenCalledWith("db1", "v2", expect.anything());
  });

  it("queries the embed scope's views when an embedId is given", () => {
    renderView({ embedId: "embed-1" });
    // The views query is scoped to the embed (issue #39), not the original db.
    expect(viewsQuery).toHaveBeenCalledWith("db1", "embed-1");
  });

  it("queries the original scope (no embedId) for the database page", () => {
    renderView();
    expect(viewsQuery).toHaveBeenCalledWith("db1", undefined);
  });

  it("persists filter/sort changes for an embed too (embedId-scoped, not session-local)", () => {
    renderView({ embedId: "embed-1" });
    fireEvent.click(screen.getByTestId("change-filters"));
    // The embed now owns its views, so its edits persist to its own scope
    // (persistViewConfig session-local special case removed in issue #39).
    expect(updateViewMutate).toHaveBeenCalled();
  });

  it("shows the table-only empty state when a filtered view returns no rows", () => {
    propertiesQuery.mockReturnValue({ data: oneProperty, isLoading: false });
    viewsQuery.mockReturnValue({
      data: [
        makeView("v1", "Grid", true, {
          filters: [{ propertyId: "p1", op: "eq", value: "o1" }],
        }),
      ],
    });
    rowsQuery.mockReturnValue({ data: [], isLoading: false });
    renderView();
    expect(screen.getByText("No rows match the current filters")).toBeTruthy();
  });
});
