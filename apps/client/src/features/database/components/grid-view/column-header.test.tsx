import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";

const reorderMutate = vi.fn();
const updateMutate = vi.fn();
const deleteMutate = vi.fn();

let databasesData: any[] = [];

vi.mock("@/features/database/queries/database-query.ts", () => ({
  useReorderPropertyMutation: () => ({ mutate: reorderMutate }),
  useUpdatePropertyMutation: () => ({ mutate: updateMutate }),
  useDeletePropertyMutation: () => ({ mutate: deleteMutate }),
  useListDatabasesQuery: () => ({ data: databasesData }),
}));

import { ColumnHeader } from "./column-header";
import { IDatabaseProperty } from "@/features/database/types/database.types.ts";

const property: IDatabaseProperty = {
  id: "prop1",
  databaseId: "db1",
  name: "Status",
  type: "text",
  config: {},
  position: "a0",
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
};

function renderHeader() {
  return render(
    <MantineProvider>
      <ColumnHeader
        property={property}
        databaseId="db1"
        spaceId="space1"
        orderedProperties={[property]}
      />
    </MantineProvider>,
  );
}

describe("ColumnHeader", () => {
  beforeEach(() => {
    reorderMutate.mockReset();
    updateMutate.mockReset();
    deleteMutate.mockReset();
    databasesData = [];
  });

  it("shows the property name", () => {
    renderHeader();
    expect(screen.getByText("Status")).toBeTruthy();
  });

  async function openRename() {
    fireEvent.click(screen.getByLabelText("Column options"));
    fireEvent.click(screen.getByText("Rename"));
    // The input is mounted after the menu closes (deferred a tick), so wait.
    return waitFor(() => screen.getByLabelText("Rename column"));
  }

  it("renames the property after editing the inline input", async () => {
    renderHeader();
    const input = await openRename();
    fireEvent.change(input, { target: { value: "Stage" } });
    fireEvent.blur(input);
    expect(updateMutate).toHaveBeenCalledWith({
      propertyId: "prop1",
      name: "Stage",
    });
  });

  it("renames the property when committing with Enter", async () => {
    renderHeader();
    const input = await openRename();
    fireEvent.change(input, { target: { value: "Stage" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(updateMutate).toHaveBeenCalledWith({
      propertyId: "prop1",
      name: "Stage",
    });
  });

  it("renames via double-click on the column name", async () => {
    renderHeader();
    fireEvent.doubleClick(screen.getByText("Status"));
    const input = await waitFor(() => screen.getByLabelText("Rename column"));
    fireEvent.change(input, { target: { value: "Stage" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(updateMutate).toHaveBeenCalledWith({
      propertyId: "prop1",
      name: "Stage",
    });
  });

  it("drops the draggable attribute while renaming", async () => {
    const { container } = renderHeader();
    // The header is draggable when not editing.
    expect(container.querySelector('[draggable="true"]')).toBeTruthy();
    await openRename();
    // While renaming, the drag adapter is unregistered so its pointer
    // interception no longer steals focus/selection from the input.
    expect(container.querySelector('[draggable="true"]')).toBeNull();
  });

  it("deletes the property from the menu", () => {
    renderHeader();
    fireEvent.click(screen.getByLabelText("Column options"));
    fireEvent.click(screen.getByText("Delete"));
    expect(deleteMutate).toHaveBeenCalledWith({ propertyId: "prop1" });
  });

  it("changes the property type from the menu", () => {
    renderHeader();
    fireEvent.click(screen.getByLabelText("Column options"));
    // Each type is a Menu.Item; clicking one commits the change (a nested
    // <Select> would close the menu before its onChange fired).
    fireEvent.click(screen.getByText("Number"));
    expect(updateMutate).toHaveBeenCalledWith({
      propertyId: "prop1",
      type: "number",
    });
  });

  it("does not re-fire when picking the current type", () => {
    renderHeader();
    fireEvent.click(screen.getByLabelText("Column options"));
    fireEvent.click(screen.getByText("Text"));
    expect(updateMutate).not.toHaveBeenCalled();
  });

  it("sends an empty options config when switching a text column to Select", () => {
    // The server rejects a select/multi_select update with no options array
    // (400). Switching from text must include config.options.
    renderHeader();
    fireEvent.click(screen.getByLabelText("Column options"));
    fireEvent.click(screen.getByText("Select"));
    expect(updateMutate).toHaveBeenCalledWith({
      propertyId: "prop1",
      type: "select",
      config: { options: [] },
    });
  });

  it("preserves existing options when switching Select to Multi-select", () => {
    const opts = [{ id: "o1", label: "Todo", color: "blue" }];
    renderHeaderWith({ type: "select", config: { options: opts } });
    fireEvent.click(screen.getByLabelText("Column options"));
    fireEvent.click(screen.getByText("Multi-select"));
    expect(updateMutate).toHaveBeenCalledWith({
      propertyId: "prop1",
      type: "multi_select",
      config: { options: opts },
    });
  });

  function renderHeaderWith(prop: Partial<IDatabaseProperty>) {
    const p = { ...property, ...prop } as IDatabaseProperty;
    return render(
      <MantineProvider>
        <ColumnHeader
          property={p}
          databaseId="db1"
          spaceId="space1"
          orderedProperties={[p]}
        />
      </MantineProvider>,
    );
  }

  it("no longer offers a header Edit options entry (now in the cell dropdown)", () => {
    renderHeaderWith({ type: "select", config: { options: [] } });
    fireEvent.click(screen.getByLabelText("Column options"));
    expect(screen.queryByText("Edit options")).toBeNull();
  });

  it("does not commit a relation switch without choosing a target database", () => {
    databasesData = [{ id: "db2", pageId: "p2", title: "People", icon: null }];
    renderHeader();
    fireEvent.click(screen.getByLabelText("Column options"));
    // Clicking the Relation entry only opens the target picker — the server
    // rejects a relation update without a targetDatabaseId (400).
    fireEvent.click(screen.getByText("Relation"));
    expect(updateMutate).not.toHaveBeenCalled();
  });

  it("commits a relation switch with the chosen target database id", () => {
    databasesData = [
      { id: "db1", pageId: "p1", title: "Self", icon: null },
      { id: "db2", pageId: "p2", title: "People", icon: null },
    ];
    renderHeader();
    fireEvent.click(screen.getByLabelText("Column options"));
    fireEvent.click(screen.getByText("Relation"));
    fireEvent.click(screen.getByText("People"));
    expect(updateMutate).toHaveBeenCalledWith({
      propertyId: "prop1",
      type: "relation",
      config: { targetDatabaseId: "db2" },
    });
  });

  it("excludes the current database from the relation target list", () => {
    databasesData = [{ id: "db1", pageId: "p1", title: "Self", icon: null }];
    renderHeader();
    fireEvent.click(screen.getByLabelText("Column options"));
    fireEvent.click(screen.getByText("Relation"));
    expect(screen.queryByText("Self")).toBeNull();
  });

  it("lets an existing relation column switch to a different target database", () => {
    databasesData = [
      { id: "db2", pageId: "p2", title: "People", icon: null },
      { id: "db3", pageId: "p3", title: "Tasks", icon: null },
    ];
    renderHeaderWith({
      type: "relation",
      config: { targetDatabaseId: "db2" },
    });
    fireEvent.click(screen.getByLabelText("Column options"));
    fireEvent.click(screen.getByText("Relation"));
    fireEvent.click(screen.getByText("Tasks"));
    expect(updateMutate).toHaveBeenCalledWith({
      propertyId: "prop1",
      type: "relation",
      config: { targetDatabaseId: "db3" },
    });
  });
});
