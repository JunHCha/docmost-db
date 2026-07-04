import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";

const propertiesQuery = vi.fn();
const rowsQuery = vi.fn();
const viewsQuery = vi.fn();
const updateViewMutate = vi.fn();
const notificationsShow = vi.fn();

vi.mock("@mantine/notifications", () => ({
  notifications: { show: (...a: unknown[]) => notificationsShow(...a) },
}));

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
    onReorderColumns,
  }: {
    properties: { id: string; name: string }[];
    spaceId: string;
    spaceSlug?: string;
    onReorderColumns?: (ids: string[]) => void;
  }) => (
    <div
      data-testid="table-view"
      data-space-id={spaceId}
      data-space-slug={spaceSlug}
    >
      {properties.map((p) => p.name).join(",")}
      <button
        data-testid="reorder-columns"
        onClick={() =>
          onReorderColumns?.([...properties].reverse().map((p) => p.id))
        }
      />
    </div>
  ),
}));
vi.mock("./board-view/board-view", () => ({
  BoardView: () => <div data-testid="board-view" />,
}));
// Expose the toolbar's filter/sort change callbacks as buttons so a test can
// trigger a config change and assert on the persist behaviour.
let sortClicks = 0;
vi.mock("./toolbar/view-toolbar", () => ({
  ViewToolbar: ({
    sorts,
    onFiltersChange,
    onSortsChange,
  }: {
    sorts: any[];
    onFiltersChange: (f: any) => void;
    onSortsChange: (s: any) => void;
  }) => (
    <div data-testid="toolbar-sorts">
      {JSON.stringify(sorts)}
      <button
        data-testid="change-filters"
        onClick={() =>
          onFiltersChange([{ propertyId: "p1", op: "eq", value: "o1" }])
        }
      />
      <button
        data-testid="change-sorts"
        // Toggle the direction each click so repeated sort edits are distinct;
        // the draft must always reflect the LATEST click (bug1 regression).
        onClick={() =>
          onSortsChange([
            {
              propertyId: "p1",
              direction: sortClicks++ % 2 === 0 ? "asc" : "desc",
            },
          ])
        }
      />
    </div>
  ),
}));

import { DatabaseView } from "./database-view";
import {
  viewDraftStorageKey,
  VIEW_DRAFT_STORAGE_VERSION,
} from "./view-draft-storage";

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
  // Build a FRESH element per (re)render: reusing the same element reference
  // makes React bail out of the update, so a changed viewsQuery mock (a remote
  // edit / refetch echo) would never reach the mounted component.
  const makeUi = () => (
    <MantineProvider>
      <DatabaseView
        databaseId={props.databaseId ?? "db1"}
        spaceId={props.spaceId ?? "space1"}
        spaceSlug={props.spaceSlug}
        initialViewId={props.initialViewId}
        embedId={props.embedId}
      />
    </MantineProvider>
  );
  const result = render(makeUi());
  return { ...result, rerenderView: () => result.rerender(makeUi()) };
}

describe("DatabaseView", () => {
  beforeEach(() => {
    // Deferred-save persists dirty drafts to localStorage (#92); clear it so a
    // draft from one test can't restore into the next and skew dirty state.
    localStorage.clear();
    sortClicks = 0;
    rowsQuery.mockReset();
    updateViewMutate.mockReset();
    notificationsShow.mockReset();
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

  it("defers a filter/sort change: nothing persists until Save is clicked (#92)", () => {
    renderView();
    fireEvent.click(screen.getByTestId("change-filters"));
    // The edit lives only in the draft — no server write yet.
    expect(updateViewMutate).not.toHaveBeenCalled();
    // The Save action appears once the draft is dirty.
    fireEvent.click(screen.getByText("Save changes"));
    expect(updateViewMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        viewId: "v1",
        config: expect.objectContaining({
          filters: [{ propertyId: "p1", op: "eq", value: "o1" }],
        }),
      }),
    );
  });

  it("hides Save/Discard until an edit makes the draft dirty (#92)", () => {
    renderView();
    expect(screen.queryByText("Save changes")).toBeNull();
    expect(screen.queryByText("Discard")).toBeNull();
    fireEvent.click(screen.getByTestId("change-filters"));
    expect(screen.getByText("Save changes")).toBeTruthy();
    expect(screen.getByText("Discard")).toBeTruthy();
  });

  it("discards the draft and hides the actions on Discard (#92)", () => {
    renderView();
    fireEvent.click(screen.getByTestId("change-filters"));
    fireEvent.click(screen.getByText("Discard"));
    expect(updateViewMutate).not.toHaveBeenCalled();
    expect(screen.queryByText("Save changes")).toBeNull();
  });

  it("silently restores a persisted dirty draft when its baseline still matches (#92)", () => {
    // A draft stored before navigating away; baseline === the current saved
    // config ({}), so on return it is restored and the actions reappear without
    // any new edit.
    localStorage.setItem(
      viewDraftStorageKey("db1", undefined, "v1"),
      JSON.stringify({
        version: VIEW_DRAFT_STORAGE_VERSION,
        baseline: {},
        draft: { filters: [{ propertyId: "p1", op: "eq", value: "o1" }] },
      }),
    );
    renderView();
    expect(screen.getByText("Save changes")).toBeTruthy();
    expect(screen.getByText("Discard")).toBeTruthy();
  });

  it("drops a persisted draft whose baseline no longer matches the saved config (#92)", () => {
    // Server config moved on (now carries a sort) since the draft was stored, so
    // the stale draft is discarded — server-latest wins — and the slot cleared.
    viewsQuery.mockReturnValue({
      data: [
        makeView("v1", "Grid", true, {
          sorts: [{ propertyId: "p9", direction: "asc" }],
        }),
      ],
    });
    const key = viewDraftStorageKey("db1", undefined, "v1");
    localStorage.setItem(
      key,
      JSON.stringify({
        version: VIEW_DRAFT_STORAGE_VERSION,
        baseline: {},
        draft: { filters: [{ propertyId: "p1", op: "eq", value: "o1" }] },
      }),
    );
    renderView();
    expect(screen.queryByText("Save changes")).toBeNull();
    expect(localStorage.getItem(key)).toBeNull();
    // The user is told their unsaved draft was lost to a remote edit.
    expect(notificationsShow).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Someone edited this view. Your unsaved draft was discarded.",
      }),
    );
  });

  it("adopts a remote config change while clean — no false Save changes", () => {
    const { rerenderView } = renderView();
    expect(screen.queryByText("Save changes")).toBeNull();
    // Another user saves a sort into this view while we merely look at it.
    viewsQuery.mockReturnValue({
      data: [
        makeView("v1", "Grid", true, {
          sorts: [{ propertyId: "p9", direction: "asc" }],
        }),
      ],
    });
    rerenderView();
    // The draft reseeds to the new saved config instead of going dirty.
    expect(screen.queryByText("Save changes")).toBeNull();
    expect(notificationsShow).toHaveBeenCalledWith(
      expect.objectContaining({
        message:
          "Someone edited this view. It has been updated to the latest version.",
      }),
    );
  });

  it("keeps a dirty draft on a remote change and warns only once per view", () => {
    const { rerenderView } = renderView();
    fireEvent.click(screen.getByTestId("change-filters")); // dirty draft
    viewsQuery.mockReturnValue({
      data: [
        makeView("v1", "Grid", true, {
          sorts: [{ propertyId: "p9", direction: "asc" }],
        }),
      ],
    });
    rerenderView();
    // The unsaved edit survives; the user is warned that saving overwrites.
    expect(screen.getByText("Save changes")).toBeTruthy();
    expect(notificationsShow).toHaveBeenCalledTimes(1);
    expect(notificationsShow).toHaveBeenCalledWith(
      expect.objectContaining({
        message:
          "Someone edited this view. Saving will overwrite their changes.",
      }),
    );
    // A further remote change to the same view does not spam another warning.
    viewsQuery.mockReturnValue({
      data: [
        makeView("v1", "Grid", true, {
          sorts: [{ propertyId: "p9", direction: "desc" }],
        }),
      ],
    });
    rerenderView();
    expect(notificationsShow).toHaveBeenCalledTimes(1);
    // Saving still persists the preserved draft.
    fireEvent.click(screen.getByText("Save changes"));
    expect(updateViewMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        viewId: "v1",
        config: expect.objectContaining({
          filters: [{ propertyId: "p1", op: "eq", value: "o1" }],
        }),
      }),
    );
  });

  it("ignores a server echo that only reorders object keys — no dirty, no noise", () => {
    viewsQuery.mockReturnValue({
      data: [
        makeView("v1", "Grid", true, {
          filters: [{ propertyId: "p1", op: "eq", value: "x" }],
        }),
      ],
    });
    const { rerenderView } = renderView();
    // A jsonb round-trip echoes the same filter with reordered keys.
    viewsQuery.mockReturnValue({
      data: [
        makeView("v1", "Grid", true, {
          filters: [{ value: "x", op: "eq", propertyId: "p1" }],
        }),
      ],
    });
    rerenderView();
    expect(screen.queryByText("Save changes")).toBeNull();
    expect(notificationsShow).not.toHaveBeenCalled();
  });

  it("keeps repeated sort edits consistent — no mid-sequence divergence (bug1)", () => {
    renderView();
    const lastSortsToRows = () => {
      const calls = rowsQuery.mock.calls;
      return calls[calls.length - 1]?.[2]?.sorts;
    };
    // Click the sort toggle several times; each click flips the direction. With
    // the draft model (no debounce/reseed/echo divergence) the rows query and
    // the toolbar must always reflect the LATEST click, never a stale snapshot.
    fireEvent.click(screen.getByTestId("change-sorts")); // asc
    expect(lastSortsToRows()).toEqual([{ propertyId: "p1", direction: "asc" }]);
    fireEvent.click(screen.getByTestId("change-sorts")); // desc
    expect(lastSortsToRows()).toEqual([
      { propertyId: "p1", direction: "desc" },
    ]);
    fireEvent.click(screen.getByTestId("change-sorts")); // asc
    expect(lastSortsToRows()).toEqual([{ propertyId: "p1", direction: "asc" }]);
    // The toolbar (which renders from the draft) agrees with the rows query.
    expect(screen.getByTestId("toolbar-sorts").textContent).toContain(
      '"direction":"asc"',
    );
    // Nothing was auto-persisted along the way (deferred save).
    expect(updateViewMutate).not.toHaveBeenCalled();
  });

  it("reorders columns into the draft and persists the view-scoped order on Save (#92)", () => {
    const twoProps = [
      { ...oneProperty[0], id: "p1", position: "a0" },
      { ...oneProperty[0], id: "p2", position: "a1" },
    ];
    propertiesQuery.mockReturnValue({ data: twoProps, isLoading: false });
    renderView();
    // The mocked TableView reverses the property order on this click.
    fireEvent.click(screen.getByTestId("reorder-columns"));
    expect(updateViewMutate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Save changes"));
    // Column order is now captured in the view config (not a global position).
    expect(updateViewMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        viewId: "v1",
        config: expect.objectContaining({
          columns: [
            expect.objectContaining({ propertyId: "p2" }),
            expect.objectContaining({ propertyId: "p1" }),
          ],
        }),
      }),
    );
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

  it("defers then persists filter/sort changes for an embed too on Save (#92)", () => {
    renderView({ embedId: "embed-1" });
    fireEvent.click(screen.getByTestId("change-filters"));
    expect(updateViewMutate).not.toHaveBeenCalled();
    // The embed owns its views, so saving persists to its own scope (issue #39).
    fireEvent.click(screen.getByText("Save changes"));
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
