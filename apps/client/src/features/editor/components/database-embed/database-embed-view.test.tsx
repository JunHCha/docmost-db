import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { MemoryRouter } from "react-router-dom";

const infoQuery = vi.fn();
const deleteNode = vi.fn();
const updateAttributes = vi.fn();

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
  }: {
    databaseId: string;
    spaceId: string;
    initialViewId?: string;
    embedId?: string;
  }) => (
    <div
      data-testid="database-view"
      data-database-id={databaseId}
      data-space-id={spaceId}
      data-initial-view-id={initialViewId}
      data-embed-id={embedId}
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
    editor: { isEditable },
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
