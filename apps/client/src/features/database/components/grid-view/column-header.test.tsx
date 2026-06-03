import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";

const reorderMutate = vi.fn();
const updateMutate = vi.fn();
const deleteMutate = vi.fn();

vi.mock("@/features/database/queries/database-query.ts", () => ({
  useReorderPropertyMutation: () => ({ mutate: reorderMutate }),
  useUpdatePropertyMutation: () => ({ mutate: updateMutate }),
  useDeletePropertyMutation: () => ({ mutate: deleteMutate }),
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
});
