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
  it("renders the header and an empty-state message when there are no sorts", () => {
    renderPopover([]);
    expect(screen.getByText("Sort by")).toBeTruthy();
    expect(screen.getByText("No sorts applied")).toBeTruthy();
  });

  it("adds a sort defaulting to the first unused property ascending", () => {
    const { onChange } = renderPopover([]);
    fireEvent.click(screen.getByText("Add sort"));
    expect(onChange).toHaveBeenCalledWith([
      { propertyId: "p1", direction: "asc" },
    ]);
  });

  it("toggles a sort direction", () => {
    const { onChange } = renderPopover([{ propertyId: "p1", direction: "asc" }]);
    fireEvent.click(screen.getByRole("combobox", { name: "Sort direction" }));
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

  it("offers Title as a sortable column", () => {
    renderPopover([{ propertyId: "p1", direction: "asc" }]);
    fireEvent.click(screen.getByRole("combobox", { name: "Sort property" }));
    expect(screen.getByText("Title")).toBeTruthy();
  });

  it("sorts by Title via its sentinel id", () => {
    const { onChange } = renderPopover([{ propertyId: "p1", direction: "asc" }]);
    fireEvent.click(screen.getByRole("combobox", { name: "Sort property" }));
    fireEvent.click(screen.getByText("Title"));
    expect(onChange).toHaveBeenCalledWith([
      { propertyId: "__title__", direction: "asc" },
    ]);
  });

  it("excludes properties already used by other sort rows from the property select", () => {
    // p1 is taken by the only row, so its property select offers only its own
    // value (p1) and the unused p2 — never a duplicate of another row.
    renderPopover([{ propertyId: "p1", direction: "asc" }]);
    fireEvent.click(screen.getByRole("combobox", { name: "Sort property" }));
    expect(screen.getByRole("option", { name: "Status" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Price" })).toBeTruthy();
  });

  it("hides a property taken by another row from this row's property select", () => {
    // Two rows: p1 and p2. The first row must not offer p2 (owned by row two).
    renderPopover([
      { propertyId: "p1", direction: "asc" },
      { propertyId: "p2", direction: "asc" },
    ]);
    const propertySelects = screen.getAllByRole("combobox", {
      name: "Sort property",
    });
    fireEvent.click(propertySelects[0]);
    expect(screen.getByRole("option", { name: "Status" })).toBeTruthy();
    expect(screen.queryByRole("option", { name: "Price" })).toBeNull();
  });

  it("hides the Add sort action once every property is used", () => {
    // Every property — both real ones plus the Title pseudo-column — is sorted
    // on, so there is nothing left to add.
    renderPopover([
      { propertyId: "__title__", direction: "asc" },
      { propertyId: "p1", direction: "asc" },
      { propertyId: "p2", direction: "asc" },
    ]);
    expect(screen.queryByText("Add sort")).toBeNull();
  });
});
