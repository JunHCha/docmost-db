import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";

const listDatabasesQuery = vi.fn();
const databasesRefetch = vi.fn();

vi.mock("@/features/database/queries/database-query.ts", () => ({
  useListDatabasesQuery: (spaceId: string) => listDatabasesQuery(spaceId),
}));

import { DatabasePickerModal } from "./database-picker-modal";

const databases = [
  { id: "db1", pageId: "p1", title: "Tasks", icon: null },
  { id: "db2", pageId: "p2", title: "Projects", icon: null },
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
    databasesRefetch.mockReset();
    listDatabasesQuery.mockReturnValue({
      data: databases,
      isLoading: false,
      isFetching: false,
      refetch: databasesRefetch,
    });
  });

  it("lists databases in the host space", () => {
    renderModal();
    expect(screen.getByText("Tasks")).toBeTruthy();
    expect(screen.getByText("Projects")).toBeTruthy();
  });

  it("confirms with the chosen database id as soon as it is picked", () => {
    // No per-view step: embedding copies every shared view of the database
    // (server seeds them), so a single click inserts the embed (issue #66).
    const onConfirm = renderModal();
    fireEvent.click(screen.getByText("Tasks"));
    expect(onConfirm).toHaveBeenCalledWith({ databaseId: "db1" });
  });

  it("filters the database list by the search query", () => {
    renderModal();
    const search = screen.getByPlaceholderText(/search databases/i);
    fireEvent.change(search, { target: { value: "proj" } });
    expect(screen.queryByText("Tasks")).toBeNull();
    expect(screen.getByText("Projects")).toBeTruthy();
  });

  it("refetches the database list when opened", () => {
    // The list is cached with a 5-min staleTime + refetchOnMount:false, so a
    // database renamed elsewhere would show its old name without this refresh.
    renderModal();
    expect(databasesRefetch).toHaveBeenCalled();
  });

  it("shows a loading splash instead of the list while databases are fetching", () => {
    listDatabasesQuery.mockReturnValue({
      data: databases,
      isLoading: false,
      isFetching: true,
      refetch: databasesRefetch,
    });
    renderModal();
    expect(screen.getByText("Loading…")).toBeTruthy();
    // The (possibly stale) list is hidden behind the splash during the refetch.
    expect(screen.queryByText("Tasks")).toBeNull();
  });
});
