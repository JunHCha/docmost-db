import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";

const createViewMutate = vi.fn();
const updateViewMutate = vi.fn();
const setDefaultMutate = vi.fn();
const deleteViewMutate = vi.fn();

vi.mock("@/features/database/queries/database-query.ts", () => ({
  useCreateViewMutation: () => ({ mutate: createViewMutate }),
  useUpdateViewMutation: () => ({ mutate: updateViewMutate }),
  useSetDefaultViewMutation: () => ({ mutate: setDefaultMutate }),
  useDeleteViewMutation: () => ({ mutate: deleteViewMutate }),
}));

import { ViewSwitcher } from "./view-switcher";
import { IDatabaseView } from "@/features/database/types/database.types.ts";

function view(id: string, name: string, isDefault = false): IDatabaseView {
  return {
    id,
    databaseId: "db1",
    name,
    type: "table",
    config: {},
    isDefault,
    position: id,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

const views = [view("v1", "Grid", true), view("v2", "Backlog")];

function renderSwitcher(
  opts: { activeViewId?: string; onActivate?: (id: string) => void } = {},
) {
  return render(
    <MantineProvider>
      <ViewSwitcher
        databaseId="db1"
        views={views}
        activeViewId={opts.activeViewId ?? "v1"}
        onActivate={opts.onActivate ?? vi.fn()}
      />
    </MantineProvider>,
  );
}

describe("ViewSwitcher", () => {
  beforeEach(() => {
    createViewMutate.mockReset();
    updateViewMutate.mockReset();
    setDefaultMutate.mockReset();
    deleteViewMutate.mockReset();
  });

  it("renders a tab per view", () => {
    renderSwitcher();
    expect(screen.getByText("Grid")).toBeTruthy();
    expect(screen.getByText("Backlog")).toBeTruthy();
  });

  it("marks the active tab", () => {
    renderSwitcher({ activeViewId: "v2" });
    expect(
      screen.getByLabelText("View Backlog").getAttribute("data-active"),
    ).toBe("true");
  });

  // Notion-style: clicking an inactive tab switches to it (no menu).
  it("activates a view when an inactive tab is clicked", () => {
    const onActivate = vi.fn();
    renderSwitcher({ onActivate });
    fireEvent.click(screen.getByText("Backlog"));
    expect(onActivate).toHaveBeenCalledWith("v2");
    expect(screen.queryByText("Rename")).toBeNull();
  });

  // Notion-style: clicking the already-active tab opens its config menu
  // instead of re-activating.
  it("opens the config menu (not re-activate) when the active tab is clicked", () => {
    const onActivate = vi.fn();
    renderSwitcher({ activeViewId: "v2", onActivate });
    fireEvent.click(screen.getByText("Backlog"));
    expect(onActivate).not.toHaveBeenCalled();
    expect(screen.getByText("Rename")).toBeTruthy();
  });

  it("creates a table view when the add button is clicked", () => {
    renderSwitcher();
    fireEvent.click(screen.getByLabelText("Add view"));
    expect(createViewMutate).toHaveBeenCalledWith({
      databaseId: "db1",
      name: "Table",
      type: "table",
    });
  });

  it("renames a view from its active-tab menu", () => {
    renderSwitcher({ activeViewId: "v2" });
    fireEvent.click(screen.getByText("Backlog"));
    fireEvent.click(screen.getByText("Rename"));
    const input = screen.getByLabelText("Rename view") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Sprint" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(updateViewMutate).toHaveBeenCalledWith({
      viewId: "v2",
      name: "Sprint",
    });
  });

  it("sets a view as default from its active-tab menu", () => {
    renderSwitcher({ activeViewId: "v2" });
    fireEvent.click(screen.getByText("Backlog"));
    fireEvent.click(screen.getByText("Set as default"));
    expect(setDefaultMutate).toHaveBeenCalledWith({ viewId: "v2" });
  });

  it("deletes a view from its active-tab menu", () => {
    renderSwitcher({ activeViewId: "v2" });
    fireEvent.click(screen.getByText("Backlog"));
    fireEvent.click(screen.getByText("Delete"));
    expect(deleteViewMutate).toHaveBeenCalledWith({ viewId: "v2" });
  });

  it("does not offer Delete for the only remaining view", () => {
    render(
      <MantineProvider>
        <ViewSwitcher
          databaseId="db1"
          views={[view("v1", "Grid", true)]}
          activeViewId="v1"
          onActivate={vi.fn()}
        />
      </MantineProvider>,
    );
    fireEvent.click(screen.getByText("Grid"));
    expect(screen.queryByText("Delete")).toBeNull();
  });
});
