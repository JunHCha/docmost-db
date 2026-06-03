import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { OptionEditPanel } from "./option-edit-panel";
import type { SelectOption } from "./option-config.ts";

const option: SelectOption = { id: "o1", label: "Todo", color: "blue" };

function renderPanel(overrides: Partial<Parameters<typeof OptionEditPanel>[0]> = {}) {
  const props = {
    option,
    onRename: vi.fn(),
    onRecolor: vi.fn(),
    onDelete: vi.fn(),
    onBack: vi.fn(),
    ...overrides,
  };
  render(
    <MantineProvider>
      <OptionEditPanel {...props} />
    </MantineProvider>,
  );
  return props;
}

describe("OptionEditPanel", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renames on Enter with the trimmed draft", () => {
    const onRename = vi.fn();
    renderPanel({ onRename });
    const input = screen.getByLabelText("Todo label");
    fireEvent.change(input, { target: { value: " Backlog " } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onRename).toHaveBeenCalledWith("Backlog");
  });

  it("renames on blur", () => {
    const onRename = vi.fn();
    renderPanel({ onRename });
    const input = screen.getByLabelText("Todo label");
    fireEvent.change(input, { target: { value: "Stage" } });
    fireEvent.blur(input);
    expect(onRename).toHaveBeenCalledWith("Stage");
  });

  it("recolors when a color swatch is clicked", () => {
    const onRecolor = vi.fn();
    renderPanel({ onRecolor });
    fireEvent.click(screen.getByLabelText("Set Todo color red"));
    expect(onRecolor).toHaveBeenCalledWith("red");
  });

  it("deletes when the delete button is clicked", () => {
    const onDelete = vi.fn();
    renderPanel({ onDelete });
    fireEvent.click(screen.getByLabelText("Delete Todo"));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("goes back when the back button is clicked", () => {
    const onBack = vi.fn();
    renderPanel({ onBack });
    fireEvent.click(screen.getByLabelText("Back to options"));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("marks the current color with a check and others without", () => {
    renderPanel();
    const current = screen.getByLabelText("Set Todo color blue");
    const other = screen.getByLabelText("Set Todo color red");
    expect(current.querySelectorAll("svg").length).toBeGreaterThan(
      other.querySelectorAll("svg").length,
    );
  });
});
