import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { attachClosestEdge } from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";

const reorderMutate = vi.fn();

// React Query's useMutation returns a NEW object every render. Emulate that so
// the regression test below exercises an unstable `reorder` dependency.
vi.mock("@/features/database/queries/database-query.ts", () => ({
  useReorderPropertyMutation: () => ({ mutate: reorderMutate }),
  useUpdatePropertyMutation: () => ({ mutate: vi.fn() }),
  useDeletePropertyMutation: () => ({ mutate: vi.fn() }),
  useListDatabasesQuery: () => ({ data: [] }),
}));

// Capture each column's drop-target config so a test can drive onDrop directly
// (pragmatic-drag-and-drop's pointer/HTML5 drag pipeline does not run in jsdom).
type DropCfg = {
  getData: (a: { input: any; element: HTMLElement }) => any;
  onDrop: (a: { self: { data: any }; source: { data: any } }) => void;
};
const dropTargets: DropCfg[] = [];
let registerCount = 0;
let cleanupCount = 0;
let lastDraggableCfg: { element: HTMLElement; dragHandle?: HTMLElement } | null =
  null;
vi.mock("@atlaskit/pragmatic-drag-and-drop/element/adapter", () => ({
  draggable: (cfg: { element: HTMLElement; dragHandle?: HTMLElement }) => {
    registerCount++;
    lastDraggableCfg = cfg;
    return () => {
      cleanupCount++;
    };
  },
  dropTargetForElements: (cfg: DropCfg) => {
    dropTargets.push(cfg);
    return () => {};
  },
}));
vi.mock("@atlaskit/pragmatic-drag-and-drop/combine", () => ({
  combine: (...cleanups: Array<() => void>) => () => cleanups.forEach((c) => c()),
}));

import { ColumnHeader } from "./column-header";
import { IDatabaseProperty } from "@/features/database/types/database.types.ts";

function prop(id: string): IDatabaseProperty {
  return {
    id,
    databaseId: "db1",
    name: id,
    type: "text",
    config: {},
    position: id,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };
}

const a = prop("a");
const b = prop("b");
const ordered = [a, b];

function renderHeaders() {
  return render(
    <MantineProvider>
      {ordered.map((p) => (
        <ColumnHeader
          key={p.id}
          property={p}
          databaseId="db1"
          spaceId="space1"
          orderedProperties={ordered}
          width={180}
          onHide={vi.fn()}
          onResize={vi.fn()}
        />
      ))}
    </MantineProvider>,
  );
}

// Build the self.data the real adapter would hand onDrop: getData() output with
// the closest edge attached. We force the edge by stubbing the element's rect so
// attachClosestEdge resolves deterministically.
function selfDataForEdge(cfg: DropCfg, edge: "left" | "right") {
  const element = document.createElement("div");
  // 100px-wide box at x=0; pointer near the right side picks the "right" edge.
  element.getBoundingClientRect = () =>
    ({ left: 0, right: 100, top: 0, bottom: 20, width: 100, height: 20, x: 0, y: 0 }) as DOMRect;
  const clientX = edge === "right" ? 95 : 5;
  return cfg.getData({ input: { clientX, clientY: 10 }, element });
}

function renderOneHeader(extraProps: Partial<{ width: number }> = {}) {
  return render(
    <MantineProvider>
      <ColumnHeader
        property={a}
        databaseId="db1"
        spaceId="space1"
        orderedProperties={ordered}
        width={extraProps.width ?? 180}
        onHide={vi.fn()}
        onResize={vi.fn()}
      />
    </MantineProvider>,
  );
}

describe("ColumnHeader column drag reorder", () => {
  beforeEach(() => {
    dropTargets.length = 0;
    reorderMutate.mockReset();
    registerCount = 0;
    cleanupCount = 0;
    lastDraggableCfg = null;
  });

  it("initiates drag only from the grip handle, not the whole header", () => {
    const { getByLabelText } = renderOneHeader();
    // The grip + options controls are both rendered (revealed on hover via CSS).
    const grip = getByLabelText("Drag to reorder column");
    expect(grip).toBeTruthy();
    expect(getByLabelText("Column options")).toBeTruthy();
    // draggable() was given that grip as its dragHandle, so a plain click on the
    // name/options never starts a drag — only the grip does.
    expect(lastDraggableCfg?.dragHandle).toBe(grip);
  });

  it("does not tear down and re-register the drag adapter on an unrelated re-render", () => {
    // Realtime row/presence updates (Phase 3/4) re-render the table frequently.
    // If the drag adapter re-registers on every render, a re-render landing mid-
    // drag aborts the native drag and the drop never fires (issue #85 regression).
    // The adapter must register once and stay registered while ordering is stable.
    const { rerender } = renderOneHeader({ width: 180 });
    expect(registerCount).toBe(1);
    rerender(
      <MantineProvider>
        <ColumnHeader
          property={a}
          databaseId="db1"
          spaceId="space1"
          orderedProperties={ordered}
          width={200}
          onHide={vi.fn()}
          onResize={vi.fn()}
        />
      </MantineProvider>,
    );
    // No teardown/re-register: ordering did not change, so the drag adapter
    // stays alive across the re-render.
    expect(cleanupCount).toBe(0);
    expect(registerCount).toBe(1);
  });

  it("calls reorder when column 'a' is dropped on the right edge of 'b'", () => {
    renderHeaders();
    // Drop targets register in render order: a, b.
    const dropOnB = dropTargets[1];
    expect(dropOnB).toBeTruthy();
    const selfData = selfDataForEdge(dropOnB, "right");
    dropOnB.onDrop({ self: { data: selfData }, source: { data: { id: "a" } } });
    expect(reorderMutate).toHaveBeenCalledWith({
      propertyId: "a",
      afterPropertyId: "b",
    });
  });
});

// Sanity: attachClosestEdge/getData round-trips an edge (guards the test helper).
describe("dnd test helper sanity", () => {
  it("attachClosestEdge stores a usable edge", () => {
    const element = document.createElement("div");
    element.getBoundingClientRect = () =>
      ({ left: 0, right: 100, top: 0, bottom: 20, width: 100, height: 20, x: 0, y: 0 }) as DOMRect;
    const data = attachClosestEdge(
      { id: "b" },
      { input: { clientX: 95, clientY: 10 } as any, element, allowedEdges: ["left", "right"] },
    );
    expect(data).toBeTruthy();
  });
});
