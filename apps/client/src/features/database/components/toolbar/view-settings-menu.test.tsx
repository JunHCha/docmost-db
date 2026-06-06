import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";

import { ViewSettingsMenu } from "./view-settings-menu";
import { IDatabaseProperty } from "@/features/database/types/database.types.ts";

function prop(
  id: string,
  name: string,
  type: IDatabaseProperty["type"] = "text",
): IDatabaseProperty {
  return {
    id,
    databaseId: "db1",
    name,
    type,
    config: {},
    position: id,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };
}

const properties = [
  prop("p1", "Status", "select"),
  prop("p2", "Owner", "text"),
];

function renderMenu(
  over: Partial<React.ComponentProps<typeof ViewSettingsMenu>> = {},
) {
  const onToggleColumn = vi.fn();
  const onChangeGroupBy = vi.fn();
  render(
    <MantineProvider>
      <ViewSettingsMenu
        viewType={over.viewType ?? "table"}
        properties={over.properties ?? properties}
        columns={over.columns}
        active={over.active ?? false}
        onToggleColumn={over.onToggleColumn ?? onToggleColumn}
        groupByPropertyId={over.groupByPropertyId}
        onChangeGroupBy={over.onChangeGroupBy ?? onChangeGroupBy}
      />
    </MantineProvider>,
  );
  return { onToggleColumn, onChangeGroupBy };
}

describe("ViewSettingsMenu", () => {
  it("opens with a Properties item and no Group by for a table view", async () => {
    renderMenu({ viewType: "table" });
    fireEvent.click(screen.getByRole("button", { name: /view settings/i }));
    expect(await screen.findByText("Properties")).toBeTruthy();
    expect(screen.queryByText("Group by")).toBeNull();
  });

  it("shows both Properties and Group by for a board view", async () => {
    renderMenu({ viewType: "board" });
    fireEvent.click(screen.getByRole("button", { name: /view settings/i }));
    expect(await screen.findByText("Properties")).toBeTruthy();
    expect(screen.getByText("Group by")).toBeTruthy();
  });

  it("toggles a column from the Properties submenu without closing the menu", async () => {
    const { onToggleColumn } = renderMenu({ viewType: "table" });
    fireEvent.click(screen.getByRole("button", { name: /view settings/i }));
    // Mantine submenus open on hover, not click.
    fireEvent.mouseEnter(await screen.findByText("Properties"));
    // The submenu's Popover dropdown stays display:none in jsdom (floating-ui
    // never positions), so query the switch including hidden nodes.
    fireEvent.click(
      await screen.findByRole("switch", { name: "Status", hidden: true }),
    );
    expect(onToggleColumn).toHaveBeenCalledWith("p1", false);
    // The root menu stays open (closeOnItemClick=false): Properties still shows.
    expect(screen.getByText("Properties")).toBeTruthy();
  });

  it("picks a group-by candidate from the board Group by submenu", async () => {
    const { onChangeGroupBy } = renderMenu({ viewType: "board" });
    fireEvent.click(screen.getByRole("button", { name: /view settings/i }));
    fireEvent.mouseEnter(await screen.findByText("Group by"));
    // Only select/multi_select candidates are listed; Status is the only one.
    fireEvent.click(await screen.findByText("Status"));
    expect(onChangeGroupBy).toHaveBeenCalledWith("p1");
  });

  it("clears the group-by when None is chosen", async () => {
    const { onChangeGroupBy } = renderMenu({
      viewType: "board",
      groupByPropertyId: "p1",
    });
    fireEvent.click(screen.getByRole("button", { name: /view settings/i }));
    fireEvent.mouseEnter(await screen.findByText("Group by"));
    fireEvent.click(await screen.findByText("None"));
    expect(onChangeGroupBy).toHaveBeenCalledWith(null);
  });
});
