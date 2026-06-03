import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";

const setMutate = vi.fn();
const clearMutate = vi.fn();
const updateMutate = vi.fn();

vi.mock("@/features/database/queries/database-query.ts", () => ({
  useSetValueMutation: () => ({ mutate: setMutate }),
  useClearValueMutation: () => ({ mutate: clearMutate }),
  useUpdatePropertyMutation: () => ({ mutate: updateMutate }),
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

  it("inline-creates an option: echoes all existing options + new one, then sets value", () => {
    renderCell(undefined);
    fireEvent.click(screen.getByLabelText("Status"));
    const search = screen.getByPlaceholderText("Search or create...");
    fireEvent.change(search, { target: { value: "Done" } });
    fireEvent.click(screen.getByText('Create "Done"'));

    expect(updateMutate).toHaveBeenCalledTimes(1);
    const call = updateMutate.mock.calls[0][0];
    expect(call.propertyId).toBe("prop1");
    const opts = call.config.options;
    // full-replace echo: existing options preserved with ids
    expect(opts.slice(0, 2)).toEqual(property.config.options);
    expect(opts).toHaveLength(3);
    expect(opts[2].label).toBe("Done");

    // then selects the brand new option's id
    expect(setMutate).toHaveBeenCalledWith({
      pageId: "page1",
      propertyId: "prop1",
      value: { type: "select", value: opts[2].id },
    });
  });
});
