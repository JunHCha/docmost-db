import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import {
  DatabaseCollabContext,
  DatabaseCollabContextValue,
} from "../../hooks/database-collab-context";
import { DatabaseCollabUser } from "../../hooks/use-database-collab";

// Stub the cell registry with a plain input so we don't pull in real cells.
vi.mock("./cells/registry", () => ({
  getCellComponent: () => (props: any) => (
    <input aria-label="cell" defaultValue={props.value ?? ""} />
  ),
}));

import { GridCell } from "./grid-cell";

const property = { id: "p1", name: "Status", type: "text" } as any;

function renderCell(overrides: Partial<DatabaseCollabContextValue> = {}) {
  const value: DatabaseCollabContextValue = {
    broadcastChange: () => {},
    onlineUsers: [],
    editingByCell: {},
    setEditingCell: () => {},
    ...overrides,
  };
  return render(
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
}

const editor = (name: string): DatabaseCollabUser => ({
  id: name,
  name,
  avatarUrl: `${name}.png`,
});

describe("GridCell editing presence", () => {
  it("marks the cell with row/property data attributes for the focus tracker", () => {
    const { container } = renderCell();
    const cell = container.querySelector("[data-db-cell]") as HTMLElement;
    expect(cell).toBeTruthy();
    expect(cell.dataset.rowId).toBe("r1");
    expect(cell.dataset.propertyId).toBe("p1");
  });

  it("highlights and shows the editor's avatar when a peer edits this cell", () => {
    const { container } = renderCell({
      editingByCell: { "r1:p1": [editor("Ada")] },
    });
    // The highlight wrapper carries the inset box-shadow.
    expect(container.querySelector("div[style*='box-shadow']")).toBeTruthy();
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
