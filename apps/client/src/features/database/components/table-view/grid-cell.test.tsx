import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import {
  DatabaseCollabContext,
  DatabaseCollabContextValue,
} from "../../hooks/database-collab-context";
import { DatabaseCollabUser } from "../../hooks/use-database-collab";

// Stub the cell registry with a plain focusable input so we can drive focus.
vi.mock("./cells/registry", () => ({
  getCellComponent: () => (props: any) => (
    <input aria-label="cell" defaultValue={props.value ?? ""} />
  ),
}));

import { GridCell } from "./grid-cell";

const property = { id: "p1", name: "Status", type: "text" } as any;

function renderCell(overrides: Partial<DatabaseCollabContextValue> = {}) {
  const setEditingCell = vi.fn();
  const value: DatabaseCollabContextValue = {
    broadcastChange: () => {},
    onlineUsers: [],
    editingByCell: {},
    setEditingCell,
    ...overrides,
  };
  const utils = render(
    <MantineProvider>
      <DatabaseCollabContext.Provider value={value}>
        <GridCell
          property={property}
          value={undefined}
          pageId="r1"
          databaseId="db1"
        />
      </DatabaseCollabContext.Provider>
    </MantineProvider>,
  );
  return { setEditingCell, ...utils };
}

const editor = (name: string): DatabaseCollabUser => ({
  id: name,
  name,
  avatarUrl: `${name}.png`,
});

describe("GridCell editing presence", () => {
  it("publishes the editing cell when a cell input is focused", () => {
    const { setEditingCell } = renderCell();
    fireEvent.focus(screen.getByLabelText("cell"));
    expect(setEditingCell).toHaveBeenCalledWith({
      rowId: "r1",
      propertyId: "p1",
    });
  });

  it("clears the editing cell when focus leaves the cell", () => {
    const { setEditingCell } = renderCell();
    const input = screen.getByLabelText("cell");
    fireEvent.focus(input);
    fireEvent.blur(input);
    expect(setEditingCell).toHaveBeenLastCalledWith(null);
  });

  it("highlights and shows the editor's avatar when a peer edits this cell", () => {
    const { container } = renderCell({
      editingByCell: { "r1:p1": [editor("Ada")] },
    });
    // The highlight wrapper carries the inset box-shadow.
    const wrapper = container.querySelector("div[style*='box-shadow']");
    expect(wrapper).toBeTruthy();
    // The editor's avatar badge is rendered.
    expect(container.querySelector(".mantine-Avatar-root")).toBeTruthy();
  });

  it("does not highlight a cell no peer is editing", () => {
    const { container } = renderCell({
      editingByCell: { "other:p9": [editor("Ada")] },
    });
    expect(container.querySelector("div[style*='box-shadow']")).toBeNull();
    expect(container.querySelector(".mantine-Avatar-root")).toBeNull();
  });
});
