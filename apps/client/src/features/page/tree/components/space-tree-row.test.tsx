import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { MemoryRouter } from "react-router-dom";

// The row pulls in a wide tree of feature hooks; stub them down so the test
// exercises only the database-badge rendering branch (issue #7).
vi.mock("jotai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("jotai")>();
  return { ...actual, useAtom: () => [false, vi.fn()] };
});
vi.mock("@/main.tsx", () => ({
  queryClient: { fetchQuery: vi.fn(), setQueryData: vi.fn() },
}));
vi.mock("@/features/page/services/page-service.ts", () => ({
  getPageById: vi.fn(),
}));
vi.mock("@/features/page/queries/page-query.ts", () => ({
  useUpdatePageMutation: () => ({
    mutateAsync: vi.fn(() => Promise.resolve()),
  }),
  fetchAllAncestorChildren: vi.fn(),
}));
vi.mock("@/features/websocket/use-query-emit.ts", () => ({
  useQueryEmit: () => vi.fn(),
}));
vi.mock(
  "@/components/layouts/global/hooks/hooks/use-toggle-sidebar.ts",
  () => ({
    useToggleSidebar: () => vi.fn(),
  }),
);
vi.mock("@/features/page/tree/hooks/use-tree-mutation.ts", () => ({
  useTreeMutation: () => ({
    handleLoadChildren: vi.fn(),
  }),
}));
// EmojiPicker lazy-loads the emoji-mart bundle; render just its icon so the
// badge sits beside a real icon element without the picker machinery.
vi.mock("@/components/ui/emoji-picker.tsx", () => ({
  default: ({ icon }: { icon: React.ReactNode }) => <span>{icon}</span>,
}));
vi.mock("./space-tree-node-menu", () => ({ NodeMenu: () => null }));

import { SpaceTreeRow } from "./space-tree-row";
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
} as unknown as SpaceTreeNode;

function renderRow(node: SpaceTreeNode) {
  return render(
    <MantineProvider>
      <MemoryRouter>
        <SpaceTreeRow
          node={node}
          level={0}
          isOpen={false}
          hasChildren={false}
          isSelected={false}
          isDragging={false}
          isReceivingDrop={null}
          toggleOpen={vi.fn()}
          rowRef={{ current: null }}
          tabIndex={0}
          treeItemProps={{} as any}
          readOnly={false}
        />
      </MemoryRouter>
    </MantineProvider>,
  );
}

describe("SpaceTreeRow database badge", () => {
  it("shows a database badge when a database has a custom icon", () => {
    renderRow({
      ...baseNode,
      pageType: "database",
      icon: "📊",
    } as unknown as SpaceTreeNode);
    expect(screen.getByLabelText("Database")).toBeTruthy();
  });

  it("omits the badge for a database using the default icon", () => {
    renderRow({
      ...baseNode,
      pageType: "database",
      icon: null,
    } as unknown as SpaceTreeNode);
    expect(screen.queryByLabelText("Database")).toBeNull();
  });

  it("omits the badge for a regular page with a custom icon", () => {
    renderRow({
      ...baseNode,
      pageType: "page",
      icon: "📄",
    } as unknown as SpaceTreeNode);
    expect(screen.queryByLabelText("Database")).toBeNull();
  });
});
