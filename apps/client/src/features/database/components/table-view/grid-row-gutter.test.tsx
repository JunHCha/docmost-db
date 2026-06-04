import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { GutterHeaderCheckbox, GutterRowCheckbox } from "./grid-row-gutter";

function renderHeader(props: Partial<Parameters<typeof GutterHeaderCheckbox>[0]> = {}) {
  const onToggleAll = vi.fn();
  render(
    <MantineProvider>
      <GutterHeaderCheckbox
        checked={props.checked ?? false}
        indeterminate={props.indeterminate ?? false}
        onToggleAll={onToggleAll}
      />
    </MantineProvider>,
  );
  return { onToggleAll };
}

function renderRow(props: Partial<Parameters<typeof GutterRowCheckbox>[0]> = {}) {
  const onSelect = vi.fn();
  render(
    <MantineProvider>
      <GutterRowCheckbox
        checked={props.checked ?? false}
        onSelect={onSelect}
      />
    </MantineProvider>,
  );
  return { onSelect };
}

describe("GutterHeaderCheckbox", () => {
  it("renders the select-all checkbox", () => {
    renderHeader();
    expect(screen.getByLabelText("Select all rows")).toBeTruthy();
  });

  it("calls onToggleAll when clicked", () => {
    const { onToggleAll } = renderHeader();
    fireEvent.click(screen.getByLabelText("Select all rows"));
    expect(onToggleAll).toHaveBeenCalledTimes(1);
  });

  it("reflects the indeterminate state", () => {
    renderHeader({ indeterminate: true });
    const input = screen.getByLabelText("Select all rows") as HTMLInputElement;
    expect(input.indeterminate).toBe(true);
  });
});

describe("GutterRowCheckbox", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders the row checkbox reflecting checked state", () => {
    renderRow({ checked: true });
    const input = screen.getByLabelText("Select row") as HTMLInputElement;
    expect(input.checked).toBe(true);
  });

  it("passes plain click as a non-modified selection", () => {
    const { onSelect } = renderRow();
    fireEvent.click(screen.getByLabelText("Select row"));
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ shift: false, meta: false }),
    );
  });

  it("forwards the shift modifier", () => {
    const { onSelect } = renderRow();
    fireEvent.click(screen.getByLabelText("Select row"), { shiftKey: true });
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ shift: true }),
    );
  });

  it("forwards the meta/ctrl modifier", () => {
    const { onSelect } = renderRow();
    fireEvent.click(screen.getByLabelText("Select row"), { metaKey: true });
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ meta: true }),
    );
  });
});
