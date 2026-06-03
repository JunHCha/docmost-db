import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";

const infoQuery = vi.fn();
const propertiesQuery = vi.fn();
const rowsQuery = vi.fn();
const updatePageMutate = vi.fn();

vi.mock("@/features/database/queries/database-query.ts", () => ({
  useDatabaseInfoQuery: () => infoQuery(),
  useDatabasePropertiesQuery: () => propertiesQuery(),
  useDatabaseRowsQuery: () => rowsQuery(),
  useSetValueMutation: () => ({ mutate: vi.fn() }),
  useClearValueMutation: () => ({ mutate: vi.fn() }),
  useCreateRowMutation: () => ({ mutate: vi.fn() }),
  useCreatePropertyMutation: () => ({ mutate: vi.fn() }),
  useReorderPropertyMutation: () => ({ mutate: vi.fn() }),
  useUpdatePropertyMutation: () => ({ mutate: vi.fn() }),
  useDeletePropertyMutation: () => ({ mutate: vi.fn() }),
  useUpdateRowTitleMutation: () => ({ mutate: vi.fn() }),
}));

vi.mock("@/features/page/queries/page-query.ts", () => ({
  useUpdatePageMutation: () => ({ mutate: updatePageMutate }),
}));

import { DatabaseViewContainer } from "./database-view-container";

const page = { id: "page1", title: "Tasks" } as any;

function renderContainer() {
  return render(
    <MantineProvider>
      <DatabaseViewContainer page={page} />
    </MantineProvider>,
  );
}

describe("DatabaseViewContainer", () => {
  it("shows a loader while the database info is loading", () => {
    infoQuery.mockReturnValue({ data: undefined, isLoading: true });
    propertiesQuery.mockReturnValue({ data: undefined });
    rowsQuery.mockReturnValue({ data: undefined });
    const { container } = renderContainer();
    expect(container.querySelector(".mantine-Loader-root")).toBeTruthy();
  });

  it("renders the grid once info, properties and rows resolve", () => {
    infoQuery.mockReturnValue({
      data: { database: { id: "db1" }, page },
      isLoading: false,
    });
    propertiesQuery.mockReturnValue({
      data: [
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
      ],
      isLoading: false,
    });
    rowsQuery.mockReturnValue({ data: [], isLoading: false });
    renderContainer();
    expect(screen.getByText("Title")).toBeTruthy();
  });

  it("renders the page title in the title input and commits edits", () => {
    updatePageMutate.mockReset();
    infoQuery.mockReturnValue({
      data: { database: { id: "db1" }, page },
      isLoading: false,
    });
    propertiesQuery.mockReturnValue({ data: [], isLoading: false });
    rowsQuery.mockReturnValue({ data: [], isLoading: false });
    renderContainer();
    const input = screen.getByLabelText("Database title") as HTMLInputElement;
    expect(input.value).toBe("Tasks");
    fireEvent.change(input, { target: { value: "Projects" } });
    fireEvent.blur(input);
    expect(updatePageMutate).toHaveBeenCalledWith({
      pageId: "page1",
      title: "Projects",
    });
  });
});
