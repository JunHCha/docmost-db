import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";

vi.mock("@/features/database/queries/database-query.ts", () => ({
  useDefaultViewId: () => "",
  useDatabaseRowsQuery: () => ({ data: [] }),
}));

import { FilterRow } from "./filter-row";
import { IDatabaseProperty } from "@/features/database/types/database.types.ts";

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

function renderRow(
  condition: { propertyId: string; op: any; value?: unknown },
  onChange = vi.fn(),
  onRemove = vi.fn(),
) {
  render(
    <MantineProvider>
      <FilterRow
        properties={properties}
        condition={condition as any}
        onChange={onChange}
        onRemove={onRemove}
      />
    </MantineProvider>,
  );
  return { onChange, onRemove };
}

describe("FilterRow", () => {
  it("changing the property resets to the first operator of the new type", () => {
    const { onChange } = renderRow({ propertyId: "p1", op: "eq", value: "o1" });
    fireEvent.click(screen.getByRole("textbox", { name: "Filter property" }));
    fireEvent.click(screen.getByText("Price"));
    // number's first op is eq; value is reset.
    expect(onChange).toHaveBeenCalledWith({
      propertyId: "p2",
      op: "eq",
      value: undefined,
    });
  });

  it("offers only the operators valid for the property type", () => {
    renderRow({ propertyId: "p2", op: "gte", value: 100 });
    fireEvent.click(screen.getByRole("textbox", { name: "Filter operator" }));
    expect(screen.getByText("Greater than or equal")).toBeTruthy();
    expect(screen.queryByText("Contains")).toBeNull();
  });

  it("emits the chosen operator", () => {
    const { onChange } = renderRow({ propertyId: "p2", op: "gte", value: 100 });
    fireEvent.click(screen.getByRole("textbox", { name: "Filter operator" }));
    fireEvent.click(screen.getByText("Less than"));
    expect(onChange).toHaveBeenCalledWith({
      propertyId: "p2",
      op: "lt",
      value: 100,
    });
  });

  it("hides the value widget for an empty op", () => {
    renderRow({ propertyId: "p1", op: "is_empty" });
    expect(screen.queryByLabelText("Filter value")).toBeNull();
  });

  it("removes the condition", () => {
    const { onRemove } = renderRow({ propertyId: "p1", op: "eq", value: "o1" });
    fireEvent.click(screen.getByLabelText("Remove filter"));
    expect(onRemove).toHaveBeenCalled();
  });
});
