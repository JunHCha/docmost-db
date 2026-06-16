import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";

// The menu pulls in a wide tree of feature hooks; stub them down to no-ops so
// the test exercises only the "Create database" visibility branch.
vi.mock("react-router-dom", () => ({
  useParams: () => ({ spaceSlug: "myspace" }),
}));
vi.mock("jotai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("jotai")>();
  return { ...actual, useAtom: () => [[], vi.fn()] };
});
// Hoisted so the mock factory (also hoisted) can close over the same spy and
// the test can assert on the emitted addTreeNode payload.
const emitMock = vi.hoisted(() => vi.fn());
vi.mock("@/features/websocket/use-query-emit.ts", () => ({
  useQueryEmit: () => emitMock,
}));
vi.mock("@/features/page/hooks/use-delete-page-modal.tsx", () => ({
  useDeletePageModal: () => ({ openDeleteModal: vi.fn() }),
}));
vi.mock("@/features/page/tree/hooks/use-tree-mutation.ts", () => ({
  useTreeMutation: () => ({
    handleDelete: vi.fn(),
    handleCreateDatabase: vi.fn(),
  }),
}));
vi.mock("@/features/favorite/queries/favorite-query", () => ({
  useFavoriteIds: () => new Set<string>(),
  useAddFavoriteMutation: () => ({ mutate: vi.fn() }),
  useRemoveFavoriteMutation: () => ({ mutate: vi.fn() }),
}));
vi.mock("@/features/page/services/page-service.ts", () => ({
  duplicatePage: vi.fn(),
}));
vi.mock("@/hooks/use-clipboard", () => ({
  useClipboard: () => ({ copy: vi.fn() }),
}));
vi.mock("@/components/common/export-modal", () => ({ default: () => null }));
vi.mock("@/features/page/components/move-page-modal.tsx", () => ({
  default: () => null,
}));
vi.mock("@/features/page/components/copy-page-modal.tsx", () => ({
  default: () => null,
}));

import { NodeMenu } from "./space-tree-node-menu";
import { duplicatePage } from "@/features/page/services/page-service.ts";
import type { SpaceTreeNode } from "@/features/page/tree/types.ts";

const baseNode = {
  id: "n1",
  slugId: "slug1",
  name: "Node",
  position: "a0",
  spaceId: "s1",
  parentPageId: null,
  hasChildren: false,
  canEdit: true,
  children: [],
} as SpaceTreeNode;

async function renderOpenMenu(node: SpaceTreeNode) {
  render(
    <MantineProvider>
      <NodeMenu node={node} canEdit />
    </MantineProvider>,
  );
  fireEvent.click(screen.getByLabelText(/Page menu for/));
  // Wait for the portal-rendered dropdown to mount (default transition).
  await screen.findByText("Copy link");
}

describe("NodeMenu Create database visibility", () => {
  it("shows Create database on a plain document node", async () => {
    await renderOpenMenu({ ...baseNode, pageType: "doc" });
    expect(screen.getByText("Create database")).toBeTruthy();
  });

  it("hides Create database on a database node", async () => {
    await renderOpenMenu({ ...baseNode, pageType: "database" });
    // The menu is open (Copy link is present) but Create database is gone.
    expect(screen.queryByText("Create database")).toBeNull();
  });
});

describe("NodeMenu duplicate keeps the page discriminator", () => {
  it("carries pageType=database onto the inserted tree node so the sidebar shows it as a database immediately (no refresh needed)", async () => {
    emitMock.mockClear();
    // Server returns the duplicated root as a real database (findById echoes the
    // stored pageType); the tree node the handler builds must preserve it.
    (duplicatePage as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "n2",
      slugId: "slug2",
      title: "Node copy",
      position: "a1",
      spaceId: "s1",
      parentPageId: null,
      icon: null,
      pageType: "database",
      // Server reports hasChildren=true (database has row pages), but rows are
      // not shown in the tree, so the node must collapse this to false.
      hasChildren: true,
    });

    await renderOpenMenu({ ...baseNode, pageType: "database" });
    fireEvent.click(screen.getByText("Duplicate"));

    await waitFor(() => expect(emitMock).toHaveBeenCalled());
    const payload = emitMock.mock.calls[0][0];
    expect(payload.operation).toBe("addTreeNode");
    expect(payload.payload.data.pageType).toBe("database");
    expect(payload.payload.data.hasChildren).toBe(false);
  });
});
