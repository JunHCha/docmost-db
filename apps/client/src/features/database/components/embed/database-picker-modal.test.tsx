import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";

const listDatabasesQuery = vi.fn();
const databaseViewsQuery = vi.fn();

vi.mock("@/features/database/queries/database-query.ts", () => ({
  useListDatabasesQuery: (spaceId: string) => listDatabasesQuery(spaceId),
  useDatabaseViewsQuery: (databaseId: string) => databaseViewsQuery(databaseId),
}));

import { DatabasePickerModal } from "./database-picker-modal";

const databases = [
  { id: "db1", pageId: "p1", title: "Tasks", icon: null },
  { id: "db2", pageId: "p2", title: "Projects", icon: null },
];

const views = [
  {
    id: "v1",
    databaseId: "db1",
    name: "Grid",
    type: "table",
    config: {},
    isDefault: true,
    position: "a0",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "v2",
    databaseId: "db1",
    name: "Backlog",
    type: "board",
    config: {},
    isDefault: false,
    position: "a1",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

function renderModal(onConfirm = vi.fn()) {
  render(
    <MantineProvider>
      <DatabasePickerModal
        opened
        spaceId="space1"
        onClose={vi.fn()}
        onConfirm={onConfirm}
      />
    </MantineProvider>,
  );
  return onConfirm;
}

describe("DatabasePickerModal", () => {
  beforeEach(() => {
    listDatabasesQuery.mockReset();
    databaseViewsQuery.mockReset();
    listDatabasesQuery.mockReturnValue({ data: databases, isLoading: false });
    databaseViewsQuery.mockReturnValue({ data: views, isLoading: false });
  });

  it("lists databases in the host space at step one", () => {
    renderModal();
    expect(screen.getByText("Tasks")).toBeTruthy();
    expect(screen.getByText("Projects")).toBeTruthy();
  });

  it("shows the views of the chosen database after selecting it", () => {
    renderModal();
    fireEvent.click(screen.getByText("Tasks"));
    expect(screen.getByText("Grid")).toBeTruthy();
    expect(screen.getByText("Backlog")).toBeTruthy();
  });

  it("confirms with the chosen database and view ids", () => {
    const onConfirm = renderModal();
    fireEvent.click(screen.getByText("Tasks"));
    fireEvent.click(screen.getByText("Backlog"));
    // confirm button
    fireEvent.click(screen.getByRole("button", { name: /insert/i }));
    expect(onConfirm).toHaveBeenCalledWith({
      databaseId: "db1",
      viewId: "v2",
    });
  });

  it("preselects the default view so the default can be inserted directly", () => {
    const onConfirm = renderModal();
    fireEvent.click(screen.getByText("Tasks"));
    fireEvent.click(screen.getByRole("button", { name: /insert/i }));
    expect(onConfirm).toHaveBeenCalledWith({
      databaseId: "db1",
      viewId: "v1",
    });
  });

  it("filters the database list by the search query", () => {
    renderModal();
    const search = screen.getByPlaceholderText(/search databases/i);
    fireEvent.change(search, { target: { value: "proj" } });
    expect(screen.queryByText("Tasks")).toBeNull();
    expect(screen.getByText("Projects")).toBeTruthy();
  });
});
