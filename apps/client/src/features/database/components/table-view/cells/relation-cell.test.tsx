import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";

const setMutate = vi.fn();
const clearMutate = vi.fn();
let rowsData: any[] = [];

vi.mock("@/features/database/queries/database-query.ts", () => ({
  useSetValueMutation: () => ({ mutate: setMutate }),
  useClearValueMutation: () => ({ mutate: clearMutate }),
  useDatabaseRowsQuery: () => ({ data: rowsData }),
  useDefaultViewId: () => "v1",
}));

import { RelationCell } from "./relation-cell";
import { IDatabaseProperty } from "@/features/database/types/database.types.ts";

const property: IDatabaseProperty = {
  id: "rel1",
  databaseId: "db1",
  name: "Projects",
  type: "relation",
  config: { targetDatabaseId: "target-db" },
  position: "a0",
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
};

function row(id: string, title: string) {
  return { row: { id, title }, values: [] };
}

function renderCell(value: any, showEmptyPlaceholder = false) {
  return render(
    <MantineProvider>
      <RelationCell
        property={property}
        value={value}
        pageId="page1"
        databaseId="db1"
        showEmptyPlaceholder={showEmptyPlaceholder}
      />
    </MantineProvider>,
  );
}

describe("RelationCell", () => {
  beforeEach(() => {
    setMutate.mockReset();
    clearMutate.mockReset();
    rowsData = [row("r1", "Alpha"), row("r2", "Beta")];
  });

  it("renders a title chip for each referenced row", () => {
    renderCell({ type: "relation", value: ["r1", "r2"] });
    expect(screen.getByText("Alpha")).toBeTruthy();
    expect(screen.getByText("Beta")).toBeTruthy();
  });

  it("shows a deleted-row placeholder for a missing id without crashing", () => {
    renderCell({ type: "relation", value: ["r1", "gone"] });
    expect(screen.getByText("Alpha")).toBeTruthy();
    expect(screen.getByText("(deleted)")).toBeTruthy();
  });

  function clickOption(label: string) {
    const option = screen
      .getAllByRole("option")
      .find((el) => el.textContent?.includes(label));
    fireEvent.click(option!);
  }

  it("adds a row id to the array on selection", () => {
    renderCell({ type: "relation", value: ["r1"] });
    fireEvent.click(screen.getByLabelText("Projects"));
    clickOption("Beta");
    expect(setMutate).toHaveBeenCalledWith({
      pageId: "page1",
      propertyId: "rel1",
      value: { type: "relation", value: ["r1", "r2"] },
    });
  });

  it("removes a row id when toggled off, keeping the rest", () => {
    renderCell({ type: "relation", value: ["r1", "r2"] });
    fireEvent.click(screen.getByLabelText("Projects"));
    clickOption("Alpha");
    expect(setMutate).toHaveBeenCalledWith({
      pageId: "page1",
      propertyId: "rel1",
      value: { type: "relation", value: ["r2"] },
    });
  });

  it("clears the value when the last reference is removed", () => {
    renderCell({ type: "relation", value: ["r1"] });
    fireEvent.click(screen.getByLabelText("Projects"));
    clickOption("Alpha");
    expect(clearMutate).toHaveBeenCalledWith({
      pageId: "page1",
      propertyId: "rel1",
    });
    expect(setMutate).not.toHaveBeenCalled();
  });

  it("shows a dimmed Empty placeholder in the panel and opens on click", () => {
    renderCell({ type: "relation", value: [] }, true);
    expect(screen.getByText("Empty")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Projects"));
    expect(screen.getAllByRole("option").length).toBeGreaterThan(0);
  });

  it("omits the Empty placeholder in the grid but stays clickable", () => {
    renderCell({ type: "relation", value: [] }, false);
    expect(screen.queryByText("Empty")).toBeNull();
    fireEvent.click(screen.getByLabelText("Projects"));
    expect(screen.getAllByRole("option").length).toBeGreaterThan(0);
  });

  it("filters the row list by title", () => {
    renderCell({ type: "relation", value: [] });
    fireEvent.click(screen.getByLabelText("Projects"));
    const search = screen.getByPlaceholderText("Search...");
    fireEvent.change(search, { target: { value: "alp" } });
    const options = screen.getAllByRole("option");
    expect(options.some((o) => o.textContent?.includes("Alpha"))).toBe(true);
    expect(options.some((o) => o.textContent?.includes("Beta"))).toBe(false);
  });
});
