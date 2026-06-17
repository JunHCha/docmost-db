import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";

// Capture each row's drop-target config so a test can drive onDrop directly
// (pragmatic-drag-and-drop's pointer pipeline does not run in jsdom).
type DropCfg = {
  getData: () => any;
  onDrop: (a: { source: { data: any } }) => void;
};
const dropTargets: DropCfg[] = [];
let registerCount = 0;
let cleanupCount = 0;
vi.mock("@atlaskit/pragmatic-drag-and-drop/element/adapter", () => ({
  draggable: () => {
    registerCount++;
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
  combine: (...cleanups: Array<() => void>) => () =>
    cleanups.forEach((c) => c()),
}));

import { SortPopover } from "./sort-popover";
import {
  IDatabaseProperty,
  ISortCondition,
} from "@/features/database/types/database.types.ts";

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

const properties = [prop("p1"), prop("p2"), prop("p3")];

function renderPopover(sorts: ISortCondition[], onChange = vi.fn()) {
  const view = render(
    <MantineProvider>
      <SortPopover properties={properties} sorts={sorts} onChange={onChange} />
    </MantineProvider>,
  );
  return { onChange, view };
}

describe("SortRow drag reorder", () => {
  beforeEach(() => {
    dropTargets.length = 0;
    registerCount = 0;
    cleanupCount = 0;
  });

  it("reorders by moving the dragged sort to the drop row's index", () => {
    const { onChange } = renderPopover([
      { propertyId: "p1", direction: "asc" },
      { propertyId: "p2", direction: "desc" },
    ]);
    // Drop targets register in render order: row 0, row 1. Drop row 0 onto row 1.
    const dropOnRow1 = dropTargets[1];
    expect(dropOnRow1).toBeTruthy();
    dropOnRow1.onDrop({ source: { data: { index: 0 } } });
    expect(onChange).toHaveBeenCalledWith([
      { propertyId: "p2", direction: "desc" },
      { propertyId: "p1", direction: "asc" },
    ]);
  });

  it("does not tear down and re-register the drag adapter on an unrelated re-render", () => {
    // Embed views re-render frequently; SortPopover gets a fresh onReorder
    // closure each render. If that closure were an effect dep, the adapter would
    // tear down and re-register every render and a re-render landing mid-drag
    // would abort the drop (#85 pattern).
    const sorts: ISortCondition[] = [
      { propertyId: "p1", direction: "asc" },
      { propertyId: "p2", direction: "desc" },
    ];
    const { view } = renderPopover(sorts);
    const initial = registerCount;
    expect(initial).toBeGreaterThan(0);
    // Re-render with an identical-shaped sorts array (new reference, as a parent
    // would pass) — the row indices are unchanged.
    view.rerender(
      <MantineProvider>
        <SortPopover
          properties={properties}
          sorts={[...sorts]}
          onChange={vi.fn()}
        />
      </MantineProvider>,
    );
    expect(cleanupCount).toBe(0);
    expect(registerCount).toBe(initial);
  });

  it("reads the latest sorts/onReorder through a ref after a re-render", () => {
    // After a re-render that swaps in a new onChange and reordered sorts, the
    // adapter (registered once) must still reorder against the CURRENT sorts.
    const onChangeA = vi.fn();
    const onChangeB = vi.fn();
    const sortsA: ISortCondition[] = [
      { propertyId: "p1", direction: "asc" },
      { propertyId: "p2", direction: "desc" },
    ];
    const { view } = renderPopover(sortsA, onChangeA);
    const sortsB: ISortCondition[] = [
      { propertyId: "p3", direction: "asc" },
      { propertyId: "p2", direction: "desc" },
    ];
    view.rerender(
      <MantineProvider>
        <SortPopover
          properties={properties}
          sorts={sortsB}
          onChange={onChangeB}
        />
      </MantineProvider>,
    );
    dropTargets[1].onDrop({ source: { data: { index: 0 } } });
    // The current onChange (B) fires with a reorder of the current sorts (B).
    expect(onChangeA).not.toHaveBeenCalled();
    expect(onChangeB).toHaveBeenCalledWith([
      { propertyId: "p2", direction: "desc" },
      { propertyId: "p3", direction: "asc" },
    ]);
  });
});
