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

function view(
  id: string,
  name: string,
  isDefault = false,
  ownerUserId: string | null = null,
): IDatabaseView {
  return {
    id,
    databaseId: "db1",
    name,
    type: "table",
    config: {},
    isDefault,
    position: id,
    embedId: null,
    ownerUserId,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

const views = [view("v1", "Grid", true), view("v2", "Backlog")];

function renderSwitcher(
  opts: {
    activeViewId?: string;
    onActivate?: (id: string) => void;
    embedId?: string;
    views?: IDatabaseView[];
  } = {},
) {
  return render(
    <MantineProvider>
      <ViewSwitcher
        databaseId="db1"
        embedId={opts.embedId}
        views={opts.views ?? views}
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

  it("creates a shared table view from the add-view menu", () => {
    renderSwitcher();
    fireEvent.click(screen.getByLabelText("Add view"));
    // Shared section renders first, so the first "Table" item is the shared one.
    fireEvent.click(screen.getAllByText("Table")[0]);
    expect(createViewMutate).toHaveBeenCalledWith({
      databaseId: "db1",
      name: "Table",
      type: "table",
      embedId: undefined,
      visibility: "shared",
    });
  });

  it("creates a personal table view from the add-view menu", () => {
    renderSwitcher();
    fireEvent.click(screen.getByLabelText("Add view"));
    // Personal section renders after shared, so the second "Table" is personal.
    fireEvent.click(screen.getAllByText("Table")[1]);
    expect(createViewMutate).toHaveBeenCalledWith({
      databaseId: "db1",
      name: "Table",
      type: "table",
      embedId: undefined,
      visibility: "personal",
    });
  });

  it("creates a shared board view from the add-view menu", () => {
    renderSwitcher();
    fireEvent.click(screen.getByLabelText("Add view"));
    fireEvent.click(screen.getAllByText("Board")[0]);
    expect(createViewMutate).toHaveBeenCalledWith({
      databaseId: "db1",
      name: "Board",
      type: "board",
      embedId: undefined,
      visibility: "shared",
    });
  });

  it("forwards the embedId to createView so the view lands in the embed scope", () => {
    renderSwitcher({ embedId: "embed-1" });
    fireEvent.click(screen.getByLabelText("Add view"));
    fireEvent.click(screen.getAllByText("Table")[0]);
    expect(createViewMutate).toHaveBeenCalledWith(
      expect.objectContaining({ embedId: "embed-1", visibility: "shared" }),
    );
  });

  it("marks a personal view tab with a lock icon", () => {
    renderSwitcher({
      views: [view("v1", "Grid", true), view("v2", "Mine", false, "user-1")],
    });
    // The shared view has no lock; the personal view does.
    expect(screen.getByLabelText("Personal view")).toBeTruthy();
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
