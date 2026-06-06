import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { MantineProvider } from "@mantine/core";
import { DatabaseEmbedContainer } from "./database-embed-container";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/features/database/queries/database-query.ts", () => ({
  useDatabaseInfoQuery: vi.fn(),
  useDatabasePropertiesQuery: vi.fn(),
  useDatabaseViewsQuery: vi.fn(),
  useDatabaseRowsQuery: vi.fn(),
  useUpdateViewMutation: vi.fn(() => ({ mutate: vi.fn() })),
}));

vi.mock("./table-view/table-view", () => ({
  TableView: () => <div data-testid="table-view" />,
}));

vi.mock("./board-view/board-view", () => ({
  BoardView: () => <div data-testid="board-view" />,
}));

vi.mock("./view-switcher", () => ({
  ViewSwitcher: () => <div data-testid="view-switcher" />,
}));

vi.mock("./toolbar/view-toolbar", () => ({
  ViewToolbar: () => <div data-testid="view-toolbar" />,
}));

import {
  useDatabaseInfoQuery,
  useDatabasePropertiesQuery,
  useDatabaseViewsQuery,
  useDatabaseRowsQuery,
} from "@/features/database/queries/database-query.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <MantineProvider>
      <QueryClientProvider client={makeClient()}>
        <MemoryRouter initialEntries={["/s/test/p/page-1"]}>
          {children}
        </MemoryRouter>
      </QueryClientProvider>
    </MantineProvider>
  );
}

function renderContainer(pageId = "page-1", initialViewId?: string) {
  return render(
    <Wrapper>
      <DatabaseEmbedContainer pageId={pageId} initialViewId={initialViewId} />
    </Wrapper>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("DatabaseEmbedContainer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: properties/rows/views all succeed with empty data
    (useDatabasePropertiesQuery as any).mockReturnValue({ data: [], isLoading: false });
    (useDatabaseRowsQuery as any).mockReturnValue({ data: [], isLoading: false });
  });

  it("shows a loader while the info query is loading", () => {
    (useDatabaseInfoQuery as any).mockReturnValue({
      isLoading: true,
      isError: false,
      data: undefined,
    });
    (useDatabaseViewsQuery as any).mockReturnValue({ data: undefined });

    renderContainer();
    // Mantine Loader uses a <span> — verify by class or just assert no error text is shown
    expect(screen.queryByText(/not a database/i)).toBeNull();
    expect(screen.queryByText(/Failed to load database/i)).toBeNull();
    // Loader span should be present
    expect(document.querySelector(".mantine-Loader-root")).toBeTruthy();
  });

  it("shows not-a-database notice when info returns no database", () => {
    (useDatabaseInfoQuery as any).mockReturnValue({
      isLoading: false,
      isError: false,
      data: { database: null, page: null },
    });
    (useDatabaseViewsQuery as any).mockReturnValue({ data: [] });

    renderContainer();
    expect(screen.getByText(/not a database/i)).toBeTruthy();
  });

  it("shows error notice when info query errors", () => {
    (useDatabaseInfoQuery as any).mockReturnValue({
      isLoading: false,
      isError: true,
      data: undefined,
    });
    (useDatabaseViewsQuery as any).mockReturnValue({ data: [] });

    renderContainer();
    expect(screen.getByText(/Failed to load database/i)).toBeTruthy();
  });

  it("renders TableView when active view type is table", () => {
    const databaseId = "db-1";
    const view = {
      id: "v-1",
      databaseId,
      name: "Table",
      type: "table",
      config: {},
      isDefault: true,
      position: "a",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    (useDatabaseInfoQuery as any).mockReturnValue({
      isLoading: false,
      isError: false,
      data: { database: { id: databaseId, spaceId: "sp-1" }, page: null },
    });
    (useDatabaseViewsQuery as any).mockReturnValue({ data: [view] });
    (useDatabasePropertiesQuery as any).mockReturnValue({
      data: [],
      isLoading: false,
    });
    (useDatabaseRowsQuery as any).mockReturnValue({
      data: [],
      isLoading: false,
    });

    renderContainer();
    expect(screen.getByTestId("table-view")).toBeTruthy();
  });

  it("renders BoardView when active view type is board", () => {
    const databaseId = "db-1";
    const view = {
      id: "v-board",
      databaseId,
      name: "Board",
      type: "board",
      config: {},
      isDefault: true,
      position: "a",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    (useDatabaseInfoQuery as any).mockReturnValue({
      isLoading: false,
      isError: false,
      data: { database: { id: databaseId, spaceId: "sp-1" }, page: null },
    });
    (useDatabaseViewsQuery as any).mockReturnValue({ data: [view] });
    (useDatabasePropertiesQuery as any).mockReturnValue({
      data: [],
      isLoading: false,
    });
    (useDatabaseRowsQuery as any).mockReturnValue({
      data: [],
      isLoading: false,
    });

    renderContainer();
    expect(screen.getByTestId("board-view")).toBeTruthy();
  });

  it("uses initialViewId to pre-select a view", () => {
    const databaseId = "db-1";
    const defaultView = {
      id: "v-default",
      databaseId,
      name: "Default",
      type: "table",
      config: {},
      isDefault: true,
      position: "a",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const otherView = {
      id: "v-other",
      databaseId,
      name: "Other",
      type: "board",
      config: {},
      isDefault: false,
      position: "b",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    (useDatabaseInfoQuery as any).mockReturnValue({
      isLoading: false,
      isError: false,
      data: { database: { id: databaseId, spaceId: "sp-1" }, page: null },
    });
    (useDatabaseViewsQuery as any).mockReturnValue({
      data: [defaultView, otherView],
    });
    (useDatabasePropertiesQuery as any).mockReturnValue({
      data: [],
      isLoading: false,
    });
    (useDatabaseRowsQuery as any).mockReturnValue({
      data: [],
      isLoading: false,
    });

    // Passing the non-default board view as initialViewId
    renderContainer("page-1", "v-other");
    expect(screen.getByTestId("board-view")).toBeTruthy();
  });
});
