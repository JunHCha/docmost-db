import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";

const setMutate = vi.fn();
const clearMutate = vi.fn();

vi.mock("@/features/database/queries/database-query.ts", () => ({
  useSetValueMutation: () => ({ mutate: setMutate }),
  useClearValueMutation: () => ({ mutate: clearMutate }),
}));

import { TextCell } from "./text-cell";
import { IDatabaseProperty } from "@/features/database/types/database.types.ts";

const property: IDatabaseProperty = {
  id: "prop1",
  databaseId: "db1",
  name: "Name",
  type: "text",
  config: {},
  position: "a0",
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
};

function renderCell(value: any, showEmptyPlaceholder = true) {
  return render(
    <MantineProvider>
      <TextCell
        property={property}
        value={value}
        pageId="page1"
        databaseId="db1"
        showEmptyPlaceholder={showEmptyPlaceholder}
      />
    </MantineProvider>,
  );
}

function renderControlled(value: any, onChange: (n: any) => void) {
  return render(
    <MantineProvider>
      <TextCell
        property={property}
        value={value}
        pageId=""
        databaseId="db1"
        showEmptyPlaceholder
        onChange={onChange}
      />
    </MantineProvider>,
  );
}

describe("TextCell", () => {
  beforeEach(() => {
    setMutate.mockReset();
    clearMutate.mockReset();
  });

  it("commits a new value with setValue on blur", () => {
    renderCell(undefined);
    fireEvent.click(screen.getByText("Empty"));
    const input = screen.getByLabelText("Name");
    fireEvent.change(input, { target: { value: "hello" } });
    fireEvent.blur(input);
    expect(setMutate).toHaveBeenCalledWith({
      pageId: "page1",
      propertyId: "prop1",
      value: { type: "text", value: "hello" },
    });
    expect(clearMutate).not.toHaveBeenCalled();
  });

  it("renders an empty value as a full-width clickable box so the panel stays clickable", () => {
    renderCell(undefined);
    // A bare empty <Text> collapses to zero width inside the panel's flex/overflow
    // column, so there is no click target. The empty box must span the cell width
    // and show a dimmed placeholder, then enter edit mode on click.
    const display = screen.getByText("Empty");
    expect(display.style.display).toBe("block");
    expect(display.style.width).toBe("100%");
    fireEvent.click(display);
    expect(screen.getByRole("textbox", { name: "Name" })).toBeTruthy();
  });

  it("omits the Empty placeholder in the grid (showEmptyPlaceholder off) but stays clickable", () => {
    const { container } = renderCell(undefined, false);
    // The grid leaves blank cells blank — no "Empty" noise in every row — while
    // the cell still spans the column so clicking it enters edit mode (#93 follow-up).
    expect(screen.queryByText("Empty")).toBeNull();
    const display = container.querySelector("p") as HTMLElement;
    expect(display.textContent).toBe("");
    expect(display.style.width).toBe("100%");
    fireEvent.click(display);
    expect(screen.getByRole("textbox", { name: "Name" })).toBeTruthy();
  });

  it("clears the value when emptied", () => {
    renderCell({ type: "text", value: "hello" });
    fireEvent.click(screen.getByText("hello"));
    const input = screen.getByLabelText("Name");
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.blur(input);
    expect(clearMutate).toHaveBeenCalledWith({
      pageId: "page1",
      propertyId: "prop1",
    });
    expect(setMutate).not.toHaveBeenCalled();
  });

  it("controlled: emits onChange and skips mutations on new value", () => {
    const onChange = vi.fn();
    renderControlled(undefined, onChange);
    fireEvent.click(screen.getByText("Empty"));
    const input = screen.getByLabelText("Name");
    fireEvent.change(input, { target: { value: "hello" } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith({ type: "text", value: "hello" });
    expect(setMutate).not.toHaveBeenCalled();
    expect(clearMutate).not.toHaveBeenCalled();
  });

  it("controlled: emits onChange(undefined) when emptied", () => {
    const onChange = vi.fn();
    renderControlled({ type: "text", value: "hello" }, onChange);
    fireEvent.click(screen.getByText("hello"));
    const input = screen.getByLabelText("Name");
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith(undefined);
    expect(setMutate).not.toHaveBeenCalled();
    expect(clearMutate).not.toHaveBeenCalled();
  });
});
