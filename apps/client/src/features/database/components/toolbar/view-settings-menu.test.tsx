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
  const onChangeDateProperty = vi.fn();
  const onChangeEndDateProperty = vi.fn();
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
        datePropertyId={over.datePropertyId}
        onChangeDateProperty={over.onChangeDateProperty ?? onChangeDateProperty}
        endDatePropertyId={over.endDatePropertyId}
        onChangeEndDateProperty={
          over.onChangeEndDateProperty ?? onChangeEndDateProperty
        }
      />
    </MantineProvider>,
  );
  return {
    onToggleColumn,
    onChangeGroupBy,
    onChangeDateProperty,
    onChangeEndDateProperty,
  };
}

// Calendar needs date-typed properties to populate the Date / End date submenus.
const calendarProps = [
  prop("d1", "Due", "date"),
  prop("d2", "Ends", "date"),
  prop("t1", "Note", "text"),
];

// Mantine 9's Menu.Sub opens through @floating-ui useHover, which reacts to
// pointer events carrying a mouse pointerType (not the bare mouseEnter older
// versions used). Fire the pointer sequence on the sub-item's menuitem element
// so the sub-dropdown mounts (jsdom keeps it display:none; query hidden nodes).
async function openSubmenu(label: string) {
  const text = await screen.findByText(label);
  const item = (text.closest("[role='menuitem']") ?? text) as HTMLElement;
  fireEvent.pointerMove(item, { pointerType: "mouse" });
  fireEvent.pointerEnter(item, { pointerType: "mouse" });
  fireEvent.mouseEnter(item);
  fireEvent.mouseMove(item);
}

describe("ViewSettingsMenu", () => {
  it("opens with a Properties item and no Group by for a table view", async () => {
    renderMenu({ viewType: "table" });
    fireEvent.click(screen.getByRole("button", { name: /view settings/i }));
    expect(await screen.findByText("Show properties")).toBeTruthy();
    expect(screen.queryByText("Group by")).toBeNull();
  });

  it("shows both Properties and Group by for a board view", async () => {
    renderMenu({ viewType: "board" });
    fireEvent.click(screen.getByRole("button", { name: /view settings/i }));
    expect(await screen.findByText("Show properties")).toBeTruthy();
    expect(screen.getByText("Group by")).toBeTruthy();
  });

  it("toggles a column from the Properties submenu without closing the menu", async () => {
    const { onToggleColumn } = renderMenu({ viewType: "table" });
    fireEvent.click(screen.getByRole("button", { name: /view settings/i }));
    // Mantine 9 Menu.Sub opens via floating-ui useHover (pointer events with a
    // mouse pointerType), so plain mouseEnter no longer opens it.
    await openSubmenu("Show properties");
    // The submenu's Popover dropdown stays display:none in jsdom (floating-ui
    // never positions), so query the eye toggle including hidden nodes.
    fireEvent.click(
      await screen.findByRole("button", { name: "Status", hidden: true }),
    );
    expect(onToggleColumn).toHaveBeenCalledWith("p1", false);
    // The root menu stays open (closeOnItemClick=false): Properties still shows.
    expect(screen.getByText("Show properties")).toBeTruthy();
  });

  it("picks a group-by candidate from the board Group by submenu", async () => {
    const { onChangeGroupBy } = renderMenu({ viewType: "board" });
    fireEvent.click(screen.getByRole("button", { name: /view settings/i }));
    await openSubmenu("Group by");
    // Only select/multi_select candidates are listed; Status is the only one.
    fireEvent.click(await screen.findByText("Status"));
    expect(onChangeGroupBy).toHaveBeenCalledWith("p1");
  });

  it("offers no None option in the board Group by submenu", async () => {
    renderMenu({ viewType: "board", groupByPropertyId: "p1" });
    fireEvent.click(screen.getByRole("button", { name: /view settings/i }));
    await openSubmenu("Group by");
    // Status (the only candidate) is listed, but there is no clear/None entry.
    expect(await screen.findByText("Status")).toBeTruthy();
    expect(screen.queryByText("None")).toBeNull();
  });

  it("shows both Date and End date submenus for a calendar view", async () => {
    renderMenu({ viewType: "calendar", properties: calendarProps });
    fireEvent.click(screen.getByRole("button", { name: /view settings/i }));
    expect(await screen.findByText("Date")).toBeTruthy();
    expect(screen.getByText("End date")).toBeTruthy();
    // Group by is board-only; it must not appear on a calendar.
    expect(screen.queryByText("Group by")).toBeNull();
    // Column show/hide is meaningless on a calendar, so it is hidden too.
    expect(screen.queryByText("Show properties")).toBeNull();
  });

  it("picks a date candidate from the calendar End date submenu", async () => {
    const { onChangeEndDateProperty } = renderMenu({
      viewType: "calendar",
      properties: calendarProps,
    });
    fireEvent.click(screen.getByRole("button", { name: /view settings/i }));
    await openSubmenu("End date");
    // Only date-typed properties are listed (Note is excluded).
    expect(screen.queryByText("Note")).toBeNull();
    fireEvent.click(await screen.findByText("Ends"));
    expect(onChangeEndDateProperty).toHaveBeenCalledWith("d2");
  });

  it("clears the End date when the already-selected property is re-picked", async () => {
    const { onChangeEndDateProperty } = renderMenu({
      viewType: "calendar",
      properties: calendarProps,
      endDatePropertyId: "d2",
    });
    fireEvent.click(screen.getByRole("button", { name: /view settings/i }));
    await openSubmenu("End date");
    fireEvent.click(await screen.findByText("Ends"));
    expect(onChangeEndDateProperty).toHaveBeenCalledWith(null);
  });
});
