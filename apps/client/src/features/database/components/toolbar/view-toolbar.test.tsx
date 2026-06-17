import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";

vi.mock("@/features/database/queries/database-query.ts", () => ({
  useDefaultViewId: () => "",
  useDatabaseRowsQuery: () => ({ data: [] }),
}));

const templateModalSpy = vi.fn();
vi.mock("../template-manager-modal", () => ({
  TemplateManagerModal: (props: { opened: boolean }) => {
    templateModalSpy(props.opened);
    return props.opened ? <div>Templates Modal</div> : null;
  },
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

function renderToolbar(
  over: Partial<React.ComponentProps<typeof ViewToolbar>> = {},
) {
  const onFiltersChange = vi.fn();
  const onSortsChange = vi.fn();
  const onToggleColumn = vi.fn();
  const onChangeGroupBy = vi.fn();
  render(
    <MantineProvider>
      <ViewToolbar
        databaseId={over.databaseId ?? "db1"}
        viewType={over.viewType ?? "table"}
        properties={properties}
        filters={over.filters ?? []}
        sorts={over.sorts ?? []}
        columns={over.columns}
        onFiltersChange={over.onFiltersChange ?? onFiltersChange}
        onSortsChange={over.onSortsChange ?? onSortsChange}
        onToggleColumn={over.onToggleColumn ?? onToggleColumn}
        groupByPropertyId={over.groupByPropertyId}
        onChangeGroupBy={over.onChangeGroupBy ?? onChangeGroupBy}
      />
    </MantineProvider>,
  );
  return { onFiltersChange, onSortsChange, onToggleColumn, onChangeGroupBy };
}

describe("ViewToolbar", () => {
  it("renders Filter, Sort and View settings icon buttons by aria-label", () => {
    renderToolbar();
    expect(screen.getByRole("button", { name: /filter/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /sort/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /view settings/i })).toBeTruthy();
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

  it("uses a blue color variable for an active filter button", () => {
    renderToolbar({ filters: [{ propertyId: "p1", op: "eq", value: "o1" }] });
    const filterBtn = screen.getByRole("button", { name: /filter/i });
    expect(filterBtn.style.getPropertyValue("--ai-color")).toContain("blue");
  });

  it("uses a gray color variable for an inactive sort button", () => {
    renderToolbar();
    const sortBtn = screen.getByRole("button", { name: /sort/i });
    expect(sortBtn.style.getPropertyValue("--ai-color")).toContain("gray");
  });

  it("toggles a column off through the View settings menu", async () => {
    const { onToggleColumn } = renderToolbar();
    fireEvent.click(screen.getByRole("button", { name: /view settings/i }));
    fireEvent.mouseEnter(await screen.findByText("Properties"));
    fireEvent.click(
      await screen.findByRole("switch", { name: "Status", hidden: true }),
    );
    expect(onToggleColumn).toHaveBeenCalledWith("p1", false);
  });

  it("marks View settings active when a column is hidden", () => {
    renderToolbar({ columns: [{ propertyId: "p1", visible: false }] });
    const btn = screen.getByRole("button", { name: /view settings/i });
    expect(btn.style.getPropertyValue("--ai-color")).toContain("blue");
  });

  it("marks View settings active on a board when group-by is set", () => {
    renderToolbar({ viewType: "board", groupByPropertyId: "p1" });
    const btn = screen.getByRole("button", { name: /view settings/i });
    expect(btn.style.getPropertyValue("--ai-color")).toContain("blue");
  });

  it("opens the template manager modal from the Templates button", () => {
    templateModalSpy.mockReset();
    renderToolbar();
    fireEvent.click(screen.getByRole("button", { name: /templates/i }));
    expect(screen.getByText("Templates Modal")).toBeTruthy();
  });
});
