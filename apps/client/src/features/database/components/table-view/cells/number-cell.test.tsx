import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";

const setMutate = vi.fn();
const clearMutate = vi.fn();

vi.mock("@/features/database/queries/database-query.ts", () => ({
  useSetValueMutation: () => ({ mutate: setMutate }),
  useClearValueMutation: () => ({ mutate: clearMutate }),
}));

import { NumberCell } from "./number-cell";
import { IDatabaseProperty } from "@/features/database/types/database.types.ts";

const property: IDatabaseProperty = {
  id: "prop1",
  databaseId: "db1",
  name: "Count",
  type: "number",
  config: {},
  position: "a0",
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
};

function renderCell(value: any, showEmptyPlaceholder = true) {
  return render(
    <MantineProvider>
      <NumberCell
        property={property}
        value={value}
        pageId="page1"
        databaseId="db1"
        showEmptyPlaceholder={showEmptyPlaceholder}
      />
    </MantineProvider>,
  );
}

describe("NumberCell", () => {
  beforeEach(() => {
    setMutate.mockReset();
    clearMutate.mockReset();
  });

  it("renders an empty value as a full-width clickable box", () => {
    renderCell(undefined);
    const display = screen.getByText("Empty");
    expect(display.style.display).toBe("block");
    expect(display.style.width).toBe("100%");
    fireEvent.click(display);
    expect(screen.getByLabelText("Count")).toBeTruthy();
  });

  it("omits the Empty placeholder in the grid but stays clickable", () => {
    const { container } = renderCell(undefined, false);
    expect(screen.queryByText("Empty")).toBeNull();
    const display = container.querySelector("p") as HTMLElement;
    expect(display.textContent).toBe("");
    expect(display.style.width).toBe("100%");
    fireEvent.click(display);
    expect(screen.getByLabelText("Count")).toBeTruthy();
  });

  it("commits a number with setValue on blur", () => {
    renderCell(undefined);
    fireEvent.click(screen.getByText("Empty"));
    const input = screen.getByLabelText("Count");
    fireEvent.change(input, { target: { value: "42" } });
    fireEvent.blur(input);
    expect(setMutate).toHaveBeenCalledWith({
      pageId: "page1",
      propertyId: "prop1",
      value: { type: "number", value: 42 },
    });
    expect(clearMutate).not.toHaveBeenCalled();
  });

  it("clears the value when emptied", () => {
    renderCell({ type: "number", value: 7 });
    fireEvent.click(screen.getByText("7"));
    const input = screen.getByLabelText("Count");
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.blur(input);
    expect(clearMutate).toHaveBeenCalledWith({
      pageId: "page1",
      propertyId: "prop1",
    });
    expect(setMutate).not.toHaveBeenCalled();
  });
});
