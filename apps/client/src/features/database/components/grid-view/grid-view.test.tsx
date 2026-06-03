import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";

const setMutate = vi.fn();
const clearMutate = vi.fn();
const createRowMutate = vi.fn();
const createPropertyMutate = vi.fn();
const updateRowTitleMutate = vi.fn();

vi.mock("@/features/database/queries/database-query.ts", () => ({
  useSetValueMutation: () => ({ mutate: setMutate }),
  useClearValueMutation: () => ({ mutate: clearMutate }),
  useCreateRowMutation: () => ({ mutate: createRowMutate }),
  useCreatePropertyMutation: () => ({ mutate: createPropertyMutate }),
  useReorderPropertyMutation: () => ({ mutate: vi.fn() }),
  useUpdatePropertyMutation: () => ({ mutate: vi.fn() }),
  useDeletePropertyMutation: () => ({ mutate: vi.fn() }),
  useUpdateRowTitleMutation: () => ({ mutate: updateRowTitleMutate }),
}));

import { GridView } from "./grid-view";
import {
  IDatabaseProperty,
  IDatabaseRow,
} from "@/features/database/types/database.types.ts";

const properties: IDatabaseProperty[] = [
  {
    id: "p1",
    databaseId: "db1",
    name: "Title",
    type: "text",
    config: {},
    position: "a0",
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  },
  {
    id: "p2",
    databaseId: "db1",
    name: "Done",
    type: "checkbox",
    config: {},
    position: "a1",
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  },
];

const rows: IDatabaseRow[] = [
  {
    row: { id: "row1", title: "First" } as any,
    values: [
      {
        id: "v1",
        pageId: "row1",
        propertyId: "p1",
        value: { type: "text", value: "Hello" },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
  },
];

function renderGrid() {
  return render(
    <MantineProvider>
      <GridView databaseId="db1" properties={properties} rows={rows} />
    </MantineProvider>,
  );
}

describe("GridView", () => {
  beforeEach(() => {
    createRowMutate.mockReset();
    createPropertyMutate.mockReset();
    updateRowTitleMutate.mockReset();
  });

  it("renders a header per property", () => {
    renderGrid();
    expect(screen.getByText("Title")).toBeTruthy();
    expect(screen.getByText("Done")).toBeTruthy();
  });

  it("renders a leading Name column header", () => {
    renderGrid();
    expect(screen.getByText("Name")).toBeTruthy();
  });

  it("renders each row's page title in the Name column", () => {
    renderGrid();
    expect(screen.getByText("First")).toBeTruthy();
  });

  it("commits an edited row title through useUpdateRowTitleMutation", () => {
    renderGrid();
    fireEvent.click(screen.getByText("First"));
    const input = screen.getByLabelText("Row title") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Second" } });
    fireEvent.blur(input);
    expect(updateRowTitleMutate).toHaveBeenCalledWith({
      pageId: "row1",
      title: "Second",
    });
  });

  it("renders each row's cell values", () => {
    renderGrid();
    expect(screen.getByText("Hello")).toBeTruthy();
  });

  it("creates a row when the add-row button is clicked", () => {
    renderGrid();
    fireEvent.click(screen.getByText("+ Row"));
    expect(createRowMutate).toHaveBeenCalledWith({ databaseId: "db1" });
  });

  it("creates a text column when the add-column button is clicked", () => {
    renderGrid();
    fireEvent.click(screen.getByLabelText("Add column"));
    expect(createPropertyMutate).toHaveBeenCalledWith({
      databaseId: "db1",
      name: "New column",
      type: "text",
    });
  });
});
