import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";

vi.mock("@/features/database/queries/database-query.ts", () => ({
  useDefaultViewId: () => "",
  useDatabaseRowsQuery: () => ({ data: [] }),
}));

import { FilterPopover } from "./filter-popover";
import {
  IDatabaseProperty,
  IFilterCondition,
} from "@/features/database/types/database.types.ts";

const properties: IDatabaseProperty[] = [
  {
    id: "p1",
    databaseId: "db1",
    name: "Status",
    type: "select",
    config: { options: [{ id: "o1", label: "Done" }] },
    position: "a0",
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  },
];

function renderPopover(filters: IFilterCondition[], onChange = vi.fn()) {
  render(
    <MantineProvider>
      <FilterPopover
        properties={properties}
        filters={filters}
        onChange={onChange}
      />
    </MantineProvider>,
  );
  return { onChange };
}

describe("FilterPopover", () => {
  it("renders the header and an empty-state message when there are no filters", () => {
    renderPopover([]);
    expect(screen.getByText("Filter by")).toBeTruthy();
    expect(screen.getByText("No filters applied")).toBeTruthy();
  });

  it("adds a filter defaulting to the first property and its first op", () => {
    const { onChange } = renderPopover([]);
    fireEvent.click(screen.getByText("Add filter"));
    expect(onChange).toHaveBeenCalledWith([
      { propertyId: "p1", op: "eq", value: undefined },
    ]);
  });

  it("removes a filter by index", () => {
    const { onChange } = renderPopover([
      { propertyId: "p1", op: "eq", value: "o1" },
    ]);
    fireEvent.click(screen.getByLabelText("Remove filter"));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it("patches an existing condition in place", () => {
    const { onChange } = renderPopover([
      { propertyId: "p1", op: "eq", value: "o1" },
    ]);
    fireEvent.click(screen.getByRole("combobox", { name: "Filter operator" }));
    fireEvent.click(screen.getByText("Is not"));
    expect(onChange).toHaveBeenCalledWith([
      { propertyId: "p1", op: "neq", value: "o1" },
    ]);
  });
});
