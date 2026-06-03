import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";

const setMutate = vi.fn();
const clearMutate = vi.fn();
const updateMutate = vi.fn();
const updateMutateAsync = vi.fn().mockResolvedValue(undefined);

vi.mock("@/features/database/queries/database-query.ts", () => ({
  useSetValueMutation: () => ({ mutate: setMutate }),
  useClearValueMutation: () => ({ mutate: clearMutate }),
  useUpdatePropertyMutation: () => ({
    mutate: updateMutate,
    mutateAsync: updateMutateAsync,
  }),
}));

import { SelectCell } from "./select-cell";
import { IDatabaseProperty } from "@/features/database/types/database.types.ts";

const property: IDatabaseProperty = {
  id: "prop1",
  databaseId: "db1",
  name: "Status",
  type: "select",
  config: {
    options: [
      { id: "o1", label: "Todo", color: "blue" },
      { id: "o2", label: "Doing", color: "green" },
    ],
  },
  position: "a0",
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
};

function renderCell(value: any, prop: IDatabaseProperty = property) {
  return render(
    <MantineProvider>
      <SelectCell property={prop} value={value} pageId="page1" databaseId="db1" />
    </MantineProvider>,
  );
}

describe("SelectCell", () => {
  beforeEach(() => {
    setMutate.mockReset();
    clearMutate.mockReset();
    updateMutate.mockReset();
    updateMutateAsync.mockReset();
    updateMutateAsync.mockResolvedValue(undefined);
  });

  it("renders the label of the selected option", () => {
    renderCell({ type: "select", value: "o2" });
    expect(screen.getByText("Doing")).toBeTruthy();
  });

  it("renders nothing breaking for an unknown (removed) option id", () => {
    const { container } = renderCell({ type: "select", value: "gone" });
    // graceful: no badge label rendered, component still mounts
    expect(screen.queryByText("Todo")).toBeNull();
    expect(screen.queryByText("Doing")).toBeNull();
    expect(container).toBeTruthy();
  });

  it("commits the option id on selection", () => {
    renderCell(undefined);
    fireEvent.click(screen.getByLabelText("Status"));
    fireEvent.click(screen.getByText("Doing"));
    expect(setMutate).toHaveBeenCalledWith({
      pageId: "page1",
      propertyId: "prop1",
      value: { type: "select", value: "o2" },
    });
  });

  it("clears the value when the selection is removed", () => {
    renderCell({ type: "select", value: "o1" });
    fireEvent.click(screen.getByLabelText("Status"));
    fireEvent.click(screen.getByText("Clear"));
    expect(clearMutate).toHaveBeenCalledWith({
      pageId: "page1",
      propertyId: "prop1",
    });
  });

  it("inline-creates an option: persists config, then sets value after it resolves", async () => {
    renderCell(undefined);
    fireEvent.click(screen.getByLabelText("Status"));
    const search = screen.getByPlaceholderText("Search or create...");
    fireEvent.change(search, { target: { value: "Done" } });
    fireEvent.click(screen.getByText('Create "Done"'));

    expect(updateMutateAsync).toHaveBeenCalledTimes(1);
    const call = updateMutateAsync.mock.calls[0][0];
    expect(call.propertyId).toBe("prop1");
    const opts = call.config.options;
    // full-replace echo: existing options preserved with ids
    expect(opts.slice(0, 2)).toEqual(property.config.options);
    expect(opts).toHaveLength(3);
    expect(opts[2].label).toBe("Done");

    // setValue must wait for the config write to resolve
    await waitFor(() => expect(setMutate).toHaveBeenCalledTimes(1));
    expect(setMutate).toHaveBeenCalledWith({
      pageId: "page1",
      propertyId: "prop1",
      value: { type: "select", value: opts[2].id },
    });
  });

  it("does not set value before the config write resolves", async () => {
    let resolveUpdate: () => void = () => {};
    updateMutateAsync.mockImplementation(
      () => new Promise<void>((res) => (resolveUpdate = res)),
    );
    renderCell(undefined);
    fireEvent.click(screen.getByLabelText("Status"));
    const search = screen.getByPlaceholderText("Search or create...");
    fireEvent.change(search, { target: { value: "Done" } });
    fireEvent.click(screen.getByText('Create "Done"'));

    // config write pending → value must not be sent yet
    expect(updateMutateAsync).toHaveBeenCalledTimes(1);
    expect(setMutate).not.toHaveBeenCalled();

    resolveUpdate();
    await waitFor(() => expect(setMutate).toHaveBeenCalledTimes(1));
  });

  function openEditPanel(label: string) {
    fireEvent.click(screen.getByLabelText("Status"));
    const edit = screen.getByLabelText(`Edit ${label}`);
    // ⋯ must not submit the option (no setValue).
    fireEvent.mouseDown(edit);
    fireEvent.click(edit);
  }

  it("opens the inline edit panel from ⋯ without selecting the option", () => {
    renderCell(undefined);
    openEditPanel("Todo");
    // Edit panel visible (rename input), list hidden.
    expect(screen.getByLabelText("Todo label")).toBeTruthy();
    expect(screen.queryByPlaceholderText("Search or create...")).toBeNull();
    // ⋯ click did not select the option.
    expect(setMutate).not.toHaveBeenCalled();
  });

  it("renames an option via full-replace echo (ids preserved)", () => {
    renderCell(undefined);
    openEditPanel("Todo");
    const input = screen.getByLabelText("Todo label");
    fireEvent.change(input, { target: { value: "Backlog" } });
    fireEvent.blur(input);
    expect(updateMutate).toHaveBeenCalledWith({
      propertyId: "prop1",
      config: {
        options: [
          { id: "o1", label: "Backlog", color: "blue" },
          { id: "o2", label: "Doing", color: "green" },
        ],
      },
    });
  });

  it("recolors an option via full-replace echo", () => {
    renderCell(undefined);
    openEditPanel("Todo");
    fireEvent.click(screen.getByLabelText("Set Todo color red"));
    expect(updateMutate).toHaveBeenCalledWith({
      propertyId: "prop1",
      config: {
        options: [
          { id: "o1", label: "Todo", color: "red" },
          { id: "o2", label: "Doing", color: "green" },
        ],
      },
    });
  });

  it("deletes an option echoing the remaining full array", () => {
    renderCell(undefined);
    openEditPanel("Todo");
    fireEvent.click(screen.getByLabelText("Delete Todo"));
    expect(updateMutate).toHaveBeenCalledWith({
      propertyId: "prop1",
      config: { options: [{ id: "o2", label: "Doing", color: "green" }] },
    });
    expect(clearMutate).not.toHaveBeenCalled();
  });

  it("clears the cell when deleting the currently selected option", () => {
    renderCell({ type: "select", value: "o1" });
    openEditPanel("Todo");
    fireEvent.click(screen.getByLabelText("Delete Todo"));
    expect(clearMutate).toHaveBeenCalledWith({
      pageId: "page1",
      propertyId: "prop1",
    });
  });
});
