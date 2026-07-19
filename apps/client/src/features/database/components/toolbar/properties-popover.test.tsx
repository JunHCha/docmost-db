import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";

import { PropertiesPopover } from "./properties-popover";
import {
  IDatabaseProperty,
  IViewColumnConfig,
} from "@/features/database/types/database.types.ts";

function prop(id: string, name: string): IDatabaseProperty {
  return {
    id,
    databaseId: "db1",
    name,
    type: "text",
    config: {},
    position: "a0",
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };
}

const properties = [prop("p1", "Status"), prop("p2", "Owner")];

function renderPopover(
  columns: IViewColumnConfig[] | undefined,
  onToggle = vi.fn(),
) {
  render(
    <MantineProvider>
      <PropertiesPopover
        properties={properties}
        columns={columns}
        onToggle={onToggle}
      />
    </MantineProvider>,
  );
  return { onToggle };
}

describe("PropertiesPopover", () => {
  it("renders a visibility toggle (eye icon) for every property", () => {
    renderPopover(undefined);
    expect(screen.getByRole("button", { name: "Status" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Owner" })).toBeTruthy();
  });

  it("shows visible:false columns as pressed-off (hidden)", () => {
    renderPopover([{ propertyId: "p1", visible: false }]);
    const status = screen.getByRole("button", { name: "Status" });
    expect(status.getAttribute("aria-pressed")).toBe("false");
  });

  it("defaults properties missing from config to on", () => {
    renderPopover([{ propertyId: "p1", visible: false }]);
    const owner = screen.getByRole("button", { name: "Owner" });
    expect(owner.getAttribute("aria-pressed")).toBe("true");
  });

  it("treats an empty/absent config as all on", () => {
    renderPopover(undefined);
    expect(
      screen
        .getByRole("button", { name: "Status" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
  });

  it("calls onToggle with false when turning a visible column off", () => {
    const { onToggle } = renderPopover(undefined);
    fireEvent.click(screen.getByRole("button", { name: "Status" }));
    expect(onToggle).toHaveBeenCalledWith("p1", false);
  });

  it("calls onToggle with true when turning a hidden column on", () => {
    const { onToggle } = renderPopover([
      { propertyId: "p1", visible: false },
    ]);
    fireEvent.click(screen.getByRole("button", { name: "Status" }));
    expect(onToggle).toHaveBeenCalledWith("p1", true);
  });
});
