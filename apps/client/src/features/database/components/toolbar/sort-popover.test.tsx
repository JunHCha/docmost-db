import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { SortPopover, moveSort } from "./sort-popover";
import {
  IDatabaseProperty,
  ISortCondition,
} from "@/features/database/types/database.types.ts";

const properties: IDatabaseProperty[] = [
  {
    id: "p1",
    databaseId: "db1",
    name: "Status",
    type: "select",
    config: {},
    position: "a0",
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  },
  {
    id: "p2",
    databaseId: "db1",
    name: "Price",
    type: "number",
    config: {},
    position: "a1",
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  },
];

function renderPopover(sorts: ISortCondition[], onChange = vi.fn()) {
  render(
    <MantineProvider>
      <SortPopover properties={properties} sorts={sorts} onChange={onChange} />
    </MantineProvider>,
  );
  return { onChange };
}

describe("moveSort", () => {
  it("moves an item from one index to another preserving order", () => {
    const sorts: ISortCondition[] = [
      { propertyId: "p1", direction: "asc" },
      { propertyId: "p2", direction: "desc" },
    ];
    expect(moveSort(sorts, 1, 0)).toEqual([
      { propertyId: "p2", direction: "desc" },
      { propertyId: "p1", direction: "asc" },
    ]);
  });

  it("is a no-op when source equals destination", () => {
    const sorts: ISortCondition[] = [{ propertyId: "p1", direction: "asc" }];
    expect(moveSort(sorts, 0, 0)).toEqual(sorts);
  });
});

describe("SortPopover", () => {
  it("adds a sort defaulting to the first unused property ascending", () => {
    const { onChange } = renderPopover([]);
    fireEvent.click(screen.getByText("Add sort"));
    expect(onChange).toHaveBeenCalledWith([
      { propertyId: "p1", direction: "asc" },
    ]);
  });

  it("toggles a sort direction", () => {
    const { onChange } = renderPopover([{ propertyId: "p1", direction: "asc" }]);
    fireEvent.click(screen.getByRole("textbox", { name: "Sort direction" }));
    fireEvent.click(screen.getByText("Descending"));
    expect(onChange).toHaveBeenCalledWith([
      { propertyId: "p1", direction: "desc" },
    ]);
  });

  it("removes a sort", () => {
    const { onChange } = renderPopover([{ propertyId: "p1", direction: "asc" }]);
    fireEvent.click(screen.getByLabelText("Remove sort"));
    expect(onChange).toHaveBeenCalledWith([]);
  });
});
