import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";

vi.mock("@/features/database/queries/database-query.ts", () => ({
  useDefaultViewId: () => "",
  useDatabaseRowsQuery: () => ({ data: [] }),
}));

import { ViewToolbar } from "./view-toolbar";
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
];

function renderToolbar(over: Partial<React.ComponentProps<typeof ViewToolbar>> = {}) {
  const onFiltersChange = vi.fn();
  const onSortsChange = vi.fn();
  render(
    <MantineProvider>
      <ViewToolbar
        properties={properties}
        filters={over.filters ?? []}
        sorts={over.sorts ?? []}
        onFiltersChange={over.onFiltersChange ?? onFiltersChange}
        onSortsChange={over.onSortsChange ?? onSortsChange}
      />
    </MantineProvider>,
  );
  return { onFiltersChange, onSortsChange };
}

describe("ViewToolbar", () => {
  it("renders Filter and Sort buttons", () => {
    renderToolbar();
    expect(screen.getByRole("button", { name: /filter/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /sort/i })).toBeTruthy();
  });

  it("shows the active filter count badge when filters exist", () => {
    renderToolbar({ filters: [{ propertyId: "p1", op: "eq", value: "o1" }] });
    const filterBtn = screen.getByRole("button", { name: /filter/i });
    expect(filterBtn.textContent).toContain("1");
  });

  it("hides the count badge when there are no conditions", () => {
    renderToolbar();
    const sortBtn = screen.getByRole("button", { name: /sort/i });
    expect(sortBtn.textContent).not.toMatch(/\d/);
  });

  it("opens the filter popover and adds a filter", async () => {
    const { onFiltersChange } = renderToolbar();
    fireEvent.click(screen.getByRole("button", { name: /filter/i }));
    fireEvent.click(await screen.findByText("Add filter"));
    expect(onFiltersChange).toHaveBeenCalledWith([
      { propertyId: "p1", op: "eq", value: undefined },
    ]);
  });

  it("opens the sort popover and adds a sort", async () => {
    const { onSortsChange } = renderToolbar();
    fireEvent.click(screen.getByRole("button", { name: /sort/i }));
    fireEvent.click(await screen.findByText("Add sort"));
    expect(onSortsChange).toHaveBeenCalledWith([
      { propertyId: "p1", direction: "asc" },
    ]);
  });
});
