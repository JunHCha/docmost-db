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

import { MultiSelectCell } from "./multi-select-cell";
import { IDatabaseProperty } from "@/features/database/types/database.types.ts";

const property: IDatabaseProperty = {
  id: "prop1",
  databaseId: "db1",
  name: "Tags",
  type: "multi_select",
  config: {
    options: [
      { id: "o1", label: "Red", color: "red" },
      { id: "o2", label: "Green", color: "green" },
    ],
  },
  position: "a0",
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
};

function renderCell(value: any) {
  return render(
    <MantineProvider>
      <MultiSelectCell
        property={property}
        value={value}
        pageId="page1"
        databaseId="db1"
      />
    </MantineProvider>,
  );
}

describe("MultiSelectCell", () => {
  beforeEach(() => {
    setMutate.mockReset();
    clearMutate.mockReset();
    updateMutate.mockReset();
    updateMutateAsync.mockReset();
    updateMutateAsync.mockResolvedValue(undefined);
  });

  it("renders a badge for each selected option", () => {
    renderCell({ type: "multi_select", value: ["o1", "o2"] });
    expect(screen.getByText("Red")).toBeTruthy();
    expect(screen.getByText("Green")).toBeTruthy();
  });

  it("ignores unknown (removed) option ids gracefully", () => {
    renderCell({ type: "multi_select", value: ["gone"] });
    expect(screen.queryByText("gone")).toBeNull();
  });

  it("adds an option id to the array on selection", () => {
    renderCell({ type: "multi_select", value: ["o1"] });
    fireEvent.click(screen.getByLabelText("Tags"));
    fireEvent.click(screen.getByText("Green"));
    expect(setMutate).toHaveBeenCalledWith({
      pageId: "page1",
      propertyId: "prop1",
      value: { type: "multi_select", value: ["o1", "o2"] },
    });
  });

  function clickOption(label: string) {
    const option = screen
      .getAllByRole("option")
      .find((el) => el.textContent?.includes(label));
    fireEvent.click(option!);
  }

  it("removes an option id when toggled off, keeping the rest", () => {
    renderCell({ type: "multi_select", value: ["o1", "o2"] });
    fireEvent.click(screen.getByLabelText("Tags"));
    clickOption("Red");
    expect(setMutate).toHaveBeenCalledWith({
      pageId: "page1",
      propertyId: "prop1",
      value: { type: "multi_select", value: ["o2"] },
    });
  });

  it("clears the value when the last option is removed", () => {
    renderCell({ type: "multi_select", value: ["o1"] });
    fireEvent.click(screen.getByLabelText("Tags"));
    clickOption("Red");
    expect(clearMutate).toHaveBeenCalledWith({
      pageId: "page1",
      propertyId: "prop1",
    });
    expect(setMutate).not.toHaveBeenCalled();
  });

  it("inline-creates an option (full echo) then adds its id after it resolves", async () => {
    renderCell({ type: "multi_select", value: ["o1"] });
    fireEvent.click(screen.getByLabelText("Tags"));
    const search = screen.getByPlaceholderText("Search or create...");
    fireEvent.change(search, { target: { value: "Blue" } });
    fireEvent.click(screen.getByText('Create "Blue"'));

    expect(updateMutateAsync).toHaveBeenCalledTimes(1);
    const call = updateMutateAsync.mock.calls[0][0];
    expect(call.propertyId).toBe("prop1");
    const opts = call.config.options;
    expect(opts.slice(0, 2)).toEqual(property.config.options);
    expect(opts).toHaveLength(3);
    expect(opts[2].label).toBe("Blue");

    await waitFor(() => expect(setMutate).toHaveBeenCalledTimes(1));
    expect(setMutate).toHaveBeenCalledWith({
      pageId: "page1",
      propertyId: "prop1",
      value: { type: "multi_select", value: ["o1", opts[2].id] },
    });
  });

  it("does not add the value before the config write resolves", async () => {
    let resolveUpdate: () => void = () => {};
    updateMutateAsync.mockImplementation(
      () => new Promise<void>((res) => (resolveUpdate = res)),
    );
    renderCell({ type: "multi_select", value: ["o1"] });
    fireEvent.click(screen.getByLabelText("Tags"));
    const search = screen.getByPlaceholderText("Search or create...");
    fireEvent.change(search, { target: { value: "Blue" } });
    fireEvent.click(screen.getByText('Create "Blue"'));

    expect(updateMutateAsync).toHaveBeenCalledTimes(1);
    expect(setMutate).not.toHaveBeenCalled();

    resolveUpdate();
    await waitFor(() => expect(setMutate).toHaveBeenCalledTimes(1));
  });

  function openEditPanel(label: string, value: any = { type: "multi_select", value: [] }) {
    renderCell(value);
    fireEvent.click(screen.getByLabelText("Tags"));
    const edit = screen.getByLabelText(`Edit ${label}`);
    fireEvent.mouseDown(edit);
    fireEvent.click(edit);
  }

  it("opens the inline edit panel from ⋯ without selecting the option", () => {
    openEditPanel("Red");
    expect(screen.getByLabelText("Red label")).toBeTruthy();
    expect(screen.queryByPlaceholderText("Search or create...")).toBeNull();
    expect(setMutate).not.toHaveBeenCalled();
  });

  it("renames an option via full-replace echo (ids preserved)", () => {
    openEditPanel("Red");
    const input = screen.getByLabelText("Red label");
    fireEvent.change(input, { target: { value: "Crimson" } });
    fireEvent.blur(input);
    expect(updateMutate).toHaveBeenCalledWith({
      propertyId: "prop1",
      config: {
        options: [
          { id: "o1", label: "Crimson", color: "red" },
          { id: "o2", label: "Green", color: "green" },
        ],
      },
    });
  });

  it("recolors an option via full-replace echo", () => {
    openEditPanel("Red");
    fireEvent.click(screen.getByLabelText("Set Red color blue"));
    expect(updateMutate).toHaveBeenCalledWith({
      propertyId: "prop1",
      config: {
        options: [
          { id: "o1", label: "Red", color: "blue" },
          { id: "o2", label: "Green", color: "green" },
        ],
      },
    });
  });

  it("deletes an option echoing the remaining full array", () => {
    openEditPanel("Red");
    fireEvent.click(screen.getByLabelText("Delete Red"));
    expect(updateMutate).toHaveBeenCalledWith({
      propertyId: "prop1",
      config: { options: [{ id: "o2", label: "Green", color: "green" }] },
    });
  });

  it("deleting an option in a multi-value only rewrites config (no value change)", () => {
    openEditPanel("Red", { type: "multi_select", value: ["o1", "o2"] });
    fireEvent.click(screen.getByLabelText("Delete Red"));
    // Pure config change: the value array is left untouched (gone id ignored).
    expect(updateMutate).toHaveBeenCalledWith({
      propertyId: "prop1",
      config: { options: [{ id: "o2", label: "Green", color: "green" }] },
    });
    expect(setMutate).not.toHaveBeenCalled();
    expect(clearMutate).not.toHaveBeenCalled();
  });

  it("deleting the only selected option does not clear the cell", () => {
    openEditPanel("Red", { type: "multi_select", value: ["o1"] });
    fireEvent.click(screen.getByLabelText("Delete Red"));
    expect(updateMutate).toHaveBeenCalledWith({
      propertyId: "prop1",
      config: { options: [{ id: "o2", label: "Green", color: "green" }] },
    });
    expect(clearMutate).not.toHaveBeenCalled();
    expect(setMutate).not.toHaveBeenCalled();
  });

  it("does not offer Create for a label that already exists (any case)", () => {
    renderCell({ type: "multi_select", value: [] });
    fireEvent.click(screen.getByLabelText("Tags"));
    const search = screen.getByPlaceholderText("Search or create...");
    fireEvent.change(search, { target: { value: "red" } });
    expect(screen.queryByText('Create "red"')).toBeNull();
  });

  it("does not rename an option to a label already used by another", () => {
    openEditPanel("Red", { type: "multi_select", value: [] });
    const input = screen.getByLabelText("Red label");
    fireEvent.change(input, { target: { value: "Green" } });
    fireEvent.blur(input);
    expect(updateMutate).not.toHaveBeenCalled();
  });
});
