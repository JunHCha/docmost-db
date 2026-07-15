import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";

const setMutate = vi.fn();
const clearMutate = vi.fn();
let rowsData: any[] = [];
let rowsFetching = false;
const rowsRefetch = vi.fn();

vi.mock("@/features/database/queries/database-query.ts", () => ({
  useSetValueMutation: () => ({ mutate: setMutate }),
  useClearValueMutation: () => ({ mutate: clearMutate }),
  useDatabaseRowsQuery: () => ({
    data: rowsData,
    refetch: rowsRefetch,
    isFetching: rowsFetching,
  }),
  useDefaultViewId: () => "v1",
}));

const openPeek = vi.fn();
vi.mock(
  "@/features/database/components/relation-peek/use-page-peek.tsx",
  () => ({
    usePagePeek: () => ({ open: openPeek }),
  }),
);

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

function row(id: string, title: string, icon?: string) {
  return { row: { id, title, icon }, values: [] };
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
    openPeek.mockReset();
    rowsRefetch.mockReset();
    rowsData = [row("r1", "Alpha"), row("r2", "Beta")];
    rowsFetching = false;
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

  it("refetches the target rows when the picker opens", () => {
    // Rows are cached with a 5-min staleTime + refetchOnMount:false, so a row
    // renamed in the target database would show its old title without this.
    renderCell({ type: "relation", value: ["r1"] });
    expect(rowsRefetch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByLabelText("Projects"));
    expect(rowsRefetch).toHaveBeenCalled();
  });

  it("shows a loading splash instead of the options while rows are fetching", () => {
    rowsFetching = true;
    renderCell({ type: "relation", value: ["r1"] });
    fireEvent.click(screen.getByLabelText("Projects"));
    expect(screen.getByText("Loading…")).toBeTruthy();
    expect(screen.queryByRole("option")).toBeNull();
  });

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

  it("renders each selected value as a page block with its icon", () => {
    rowsData = [row("r1", "Alpha", "🚀")];
    renderCell({ type: "relation", value: ["r1"] });
    expect(screen.getByText("Alpha")).toBeTruthy();
    expect(screen.getByText("🚀")).toBeTruthy();
  });

  it("opens the peek in the aside host from the chip icon", () => {
    renderCell({ type: "relation", value: ["r1"] });
    fireEvent.click(screen.getByLabelText("Open in side panel"));
    expect(openPeek).toHaveBeenCalledWith("r1", "aside");
  });

  it("no longer offers the modal open affordance (modal host disabled)", () => {
    renderCell({ type: "relation", value: ["r1"] });
    expect(screen.queryByLabelText("Open in modal")).toBeNull();
  });

  it("opens the relation picker when the chip title is clicked", () => {
    renderCell({ type: "relation", value: ["r1"] });
    fireEvent.click(screen.getByText("Alpha"));
    expect(screen.getAllByRole("option").length).toBeGreaterThan(0);
  });

  it("does not open the picker when a chip open-icon is clicked", () => {
    renderCell({ type: "relation", value: ["r1"] });
    fireEvent.click(screen.getByLabelText("Open in side panel"));
    expect(screen.queryAllByRole("option")).toHaveLength(0);
  });

  it("does not render the deleted placeholder as a clickable chip", () => {
    renderCell({ type: "relation", value: ["gone"] });
    expect(screen.queryByLabelText("Open in side panel")).toBeNull();
    expect(screen.getByText("(deleted)")).toBeTruthy();
  });

  function renderControlled(value: any, onChange: (n: any) => void) {
    return render(
      <MantineProvider>
        <RelationCell
          property={property}
          value={value}
          pageId=""
          databaseId="db1"
          onChange={onChange}
        />
      </MantineProvider>,
    );
  }

  it("controlled: emits onChange(relation array) on selection, no mutation", () => {
    const onChange = vi.fn();
    renderControlled({ type: "relation", value: ["r1"] }, onChange);
    fireEvent.click(screen.getByLabelText("Projects"));
    clickOption("Beta");
    expect(onChange).toHaveBeenCalledWith({
      type: "relation",
      value: ["r1", "r2"],
    });
    expect(setMutate).not.toHaveBeenCalled();
  });

  it("controlled: emits onChange(undefined) when last reference removed", () => {
    const onChange = vi.fn();
    renderControlled({ type: "relation", value: ["r1"] }, onChange);
    fireEvent.click(screen.getByLabelText("Projects"));
    clickOption("Alpha");
    expect(onChange).toHaveBeenCalledWith(undefined);
    expect(clearMutate).not.toHaveBeenCalled();
  });

  it("floors the dropdown to a minimum width so a narrow column/panel can't cramp it", () => {
    renderCell(undefined);
    fireEvent.click(screen.getByLabelText("Projects"));
    // width defaults to "target"; a min-width floor keeps rows legible in a
    // narrow column or empty side-panel value (bug: cramped relation dropdown).
    const dropdown = document.querySelector(
      "[class*='Combobox-dropdown']",
    ) as HTMLElement | null;
    expect(dropdown).toBeTruthy();
    expect(dropdown!.style.minWidth).toBe("240px");
  });
});
