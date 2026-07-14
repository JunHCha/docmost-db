import { describe, it, expect } from "vitest";
import { DragHandlePlugin } from "./drag-handle";

// Build the plugin the way GlobalDragHandle.configure() does and reach for the
// dragstart/drop DOM handlers. We exercise the handlers directly (jsdom cannot
// drive a real HTML5 drag pipeline) with a minimal view + event stub.
function handlers() {
  const plugin = DragHandlePlugin({
    pluginKey: "globalDragHandle",
    dragHandleWidth: 20,
    scrollThreshold: 100,
    excludedTags: [],
    customNodes: ["databaseView"],
    atomNodes: [],
  });
  const dom = plugin.props.handleDOMEvents as {
    dragstart: (view: any, event: any) => boolean | void;
    drop: (view: any, event: any) => boolean | void;
  };
  return dom;
}

function viewStub() {
  const dom = document.createElement("div");
  return { dom, dragging: null, posAtCoords: () => null, state: {} } as any;
}

describe("GlobalDragHandle — database embed grid isolation", () => {
  it("dragstart returns true when the drag starts inside a database grid", () => {
    // Embedded grid: PM must skip its built-in dragstart (which would clearData
    // and set view.dragging) so pragmatic-drag-and-drop drives the column drag
    // and the drop indicator can show.
    const grid = document.createElement("div");
    grid.setAttribute("data-database-grid", "");
    const grip = document.createElement("button");
    grid.appendChild(grip);
    document.body.appendChild(grid);

    const view = viewStub();
    const result = handlers().dragstart(view, { target: grip });

    expect(result).toBe(true);
    // PM's cosmetic "dragging" class must NOT be applied for a grid drag.
    expect(view.dom.classList.contains("dragging")).toBe(false);

    grid.remove();
  });

  it("dragstart falls through for ordinary editor content drags", () => {
    const para = document.createElement("p");
    document.body.appendChild(para);

    const view = viewStub();
    const result = handlers().dragstart(view, { target: para });

    // Not a grid drag: PM keeps its normal behavior (no early-out) and the
    // editor's dragging class is applied.
    expect(result).toBeUndefined();
    expect(view.dom.classList.contains("dragging")).toBe(true);

    para.remove();
  });

  it("drop returns true (skipping PM) for a drop landing inside the grid", () => {
    const grid = document.createElement("div");
    grid.setAttribute("data-database-grid", "");
    const cell = document.createElement("div");
    grid.appendChild(cell);
    document.body.appendChild(grid);

    const result = handlers().drop(viewStub(), { target: cell });

    expect(result).toBe(true);

    grid.remove();
  });
});
