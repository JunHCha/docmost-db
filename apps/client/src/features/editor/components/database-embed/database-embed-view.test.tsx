import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { MemoryRouter } from "react-router-dom";

const infoQuery = vi.fn();
const deleteNode = vi.fn();
const updateAttributes = vi.fn();
const setNodeSelection = vi.fn();
const focus = vi.fn(() => ({ setNodeSelection }));
const getPos = vi.fn(() => 7);

vi.mock("@/features/database/queries/database-query.ts", () => ({
  useDatabaseInfoByIdQuery: () => infoQuery(),
}));

// The embedded body is exercised in its own suite; here we only assert which
// branch renders and which props the embed hands down.
vi.mock("@/features/database/components/database-view.tsx", () => ({
  DatabaseView: ({
    databaseId,
    spaceId,
    initialViewId,
    embedId,
    pageId,
  }: {
    databaseId: string;
    spaceId: string;
    initialViewId?: string;
    embedId?: string;
    pageId?: string;
  }) => (
    <div
      data-testid="database-view"
      data-database-id={databaseId}
      data-space-id={spaceId}
      data-initial-view-id={initialViewId}
      data-embed-id={embedId}
      data-page-id={pageId}
    />
  ),
}));

import DatabaseEmbedView from "./database-embed-view";

const database = {
  id: "db1",
  pageId: "p1",
  spaceId: "space1",
  workspaceId: "ws1",
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
};
const page = { id: "p1", slugId: "abc", title: "Roadmap" };

function renderEmbed(
  attrs: {
    databaseId?: string | null;
    viewId?: string | null;
    embedId?: string | null;
  } = {},
  isEditable = true,
) {
  const props = {
    editor: {
      isEditable,
      storage: { pageId: "host-page-1" },
      commands: { setNodeSelection },
      chain: () => ({ focus }),
    },
    getPos,
    node: {
      attrs: {
        databaseId: attrs.databaseId ?? "db1",
        viewId: attrs.viewId ?? "v1",
        embedId: "embedId" in attrs ? attrs.embedId : "embed-1",
      },
    },
    deleteNode,
    updateAttributes,
    selected: false,
  } as any;
  return render(
    <MantineProvider>
      <MemoryRouter initialEntries={["/s/team/p/host"]}>
        <DatabaseEmbedView {...props} />
      </MemoryRouter>
    </MantineProvider>,
  );
}

describe("DatabaseEmbedView", () => {
  beforeEach(() => {
    infoQuery.mockReset();
    deleteNode.mockReset();
    updateAttributes.mockReset();
    setNodeSelection.mockReset();
  });

  it("mounts DatabaseView with the resolved space, pinned view and embed scope", () => {
    infoQuery.mockReturnValue({
      data: { database, page },
      isLoading: false,
      isError: false,
      error: null,
    });
    renderEmbed({ viewId: "v2", embedId: "embed-9" });
    const body = screen.getByTestId("database-view");
    expect(body.getAttribute("data-database-id")).toBe("db1");
    expect(body.getAttribute("data-space-id")).toBe("space1");
    expect(body.getAttribute("data-initial-view-id")).toBe("v2");
    // The embed scopes its views by embedId (issue #39).
    expect(body.getAttribute("data-embed-id")).toBe("embed-9");
    // The host page id (issue #60) flows through for orphan reconcile.
    expect(body.getAttribute("data-page-id")).toBe("host-page-1");
  });

  it("backfills a missing embedId on mount (legacy embeds)", () => {
    infoQuery.mockReturnValue({
      data: { database, page },
      isLoading: false,
      isError: false,
      error: null,
    });
    renderEmbed({ embedId: null });
    // A legacy node without an embedId gets one assigned once on mount.
    expect(updateAttributes).toHaveBeenCalledTimes(1);
    expect(updateAttributes).toHaveBeenCalledWith(
      expect.objectContaining({ embedId: expect.any(String) }),
    );
  });

  it("does not re-assign an embedId when one already exists (idempotent)", () => {
    infoQuery.mockReturnValue({
      data: { database, page },
      isLoading: false,
      isError: false,
      error: null,
    });
    renderEmbed({ embedId: "embed-1" });
    expect(updateAttributes).not.toHaveBeenCalled();
  });

  it("shows a no-access placeholder on 403", () => {
    infoQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: { response: { status: 403 } },
    });
    renderEmbed();
    expect(
      screen.getByText("You don't have access to this database"),
    ).toBeTruthy();
    expect(screen.queryByTestId("database-view")).toBeNull();
  });

  it("does not mount the body or query database info until visible", () => {
    (globalThis as any).__ioAutoIntersect = false;
    try {
      renderEmbed();
      // Lazy mount: the body (and its info query) must not run while off-screen.
      expect(infoQuery).not.toHaveBeenCalled();
      expect(screen.queryByTestId("database-view")).toBeNull();
      expect(screen.getByTestId("database-embed-placeholder")).toBeTruthy();
    } finally {
      (globalThis as any).__ioAutoIntersect = true;
    }
  });

  it("mounts the body once it scrolls into view and stays mounted afterwards", () => {
    (globalThis as any).__ioAutoIntersect = false;
    infoQuery.mockReturnValue({
      data: { database, page },
      isLoading: false,
      isError: false,
      error: null,
    });
    try {
      renderEmbed();
      const observers = (globalThis as any).__intersectionObservers as any[];
      const observer = observers[observers.length - 1];

      // Becomes visible -> body mounts and the info query runs.
      act(() => observer.trigger(true));
      expect(screen.getByTestId("database-view")).toBeTruthy();
      expect(infoQuery).toHaveBeenCalled();
      // Once visible the observer disconnects (stay-mounted, no flicker).
      expect(observer.disconnected).toBe(true);

      // Scrolling back out keeps the body mounted.
      act(() => observer.trigger(false));
      expect(screen.getByTestId("database-view")).toBeTruthy();
    } finally {
      (globalThis as any).__ioAutoIntersect = true;
    }
  });

  it("selects the embed node when its header is pressed", () => {
    // The header doubles as the node's selection handle: pressing it must put
    // a NodeSelection on the embed so it behaves like an ordinary block.
    infoQuery.mockReturnValue({
      data: { database, page },
      isLoading: false,
      isError: false,
      error: null,
    });
    const { container } = renderEmbed();
    const header = container.querySelector(
      '[data-drag-handle]',
    ) as HTMLElement;
    expect(header).toBeTruthy();
    fireEvent.mouseDown(header);
    expect(setNodeSelection).toHaveBeenCalledWith(7);
  });

  it("does not select the node on header press when read-only", () => {
    infoQuery.mockReturnValue({
      data: { database, page },
      isLoading: false,
      isError: false,
      error: null,
    });
    const { container } = renderEmbed({}, false);
    const header = container.querySelector(
      '[data-drag-handle]',
    ) as HTMLElement;
    if (header) fireEvent.mouseDown(header);
    expect(setNodeSelection).not.toHaveBeenCalled();
  });

  it("shows a not-found placeholder with remove action when the database is gone", () => {
    infoQuery.mockReturnValue({
      data: { database: null, page: null },
      isLoading: false,
      isError: false,
      error: null,
    });
    renderEmbed();
    expect(
      screen.getByText("The original database no longer exists"),
    ).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Remove from page"));
    expect(deleteNode).toHaveBeenCalled();
  });
});
