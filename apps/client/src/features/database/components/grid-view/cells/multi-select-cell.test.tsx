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

  it("inline-creates an option (full echo) then adds its id", () => {
    renderCell({ type: "multi_select", value: ["o1"] });
    fireEvent.click(screen.getByLabelText("Tags"));
    const search = screen.getByPlaceholderText("Search or create...");
    fireEvent.change(search, { target: { value: "Blue" } });
    fireEvent.click(screen.getByText('Create "Blue"'));

    const call = updateMutate.mock.calls[0][0];
    expect(call.propertyId).toBe("prop1");
    const opts = call.config.options;
    expect(opts.slice(0, 2)).toEqual(property.config.options);
    expect(opts).toHaveLength(3);
    expect(opts[2].label).toBe("Blue");

    expect(setMutate).toHaveBeenCalledWith({
      pageId: "page1",
      propertyId: "prop1",
      value: { type: "multi_select", value: ["o1", opts[2].id] },
    });
  });
});
