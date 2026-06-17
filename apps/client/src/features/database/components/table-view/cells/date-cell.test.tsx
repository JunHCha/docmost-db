import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";

const setMutate = vi.fn();
const clearMutate = vi.fn();

vi.mock("@/features/database/queries/database-query.ts", () => ({
  useSetValueMutation: () => ({ mutate: setMutate }),
  useClearValueMutation: () => ({ mutate: clearMutate }),
}));

import { DateCell } from "./date-cell";
import { IDatabaseProperty } from "@/features/database/types/database.types.ts";

const property: IDatabaseProperty = {
  id: "prop1",
  databaseId: "db1",
  name: "Due",
  type: "date",
  config: {},
  position: "a0",
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
};

function renderCell(value: any, showEmptyPlaceholder = true) {
  return render(
    <MantineProvider>
      <DateCell
        property={property}
        value={value}
        pageId="page1"
        databaseId="db1"
        showEmptyPlaceholder={showEmptyPlaceholder}
      />
    </MantineProvider>,
  );
}

describe("DateCell", () => {
  beforeEach(() => {
    setMutate.mockReset();
    clearMutate.mockReset();
  });

  it("displays the stored ISO date", () => {
    renderCell({ type: "date", value: "2026-06-01" });
    expect(screen.getByText("2026-06-01")).toBeTruthy();
  });

  it("renders an empty value as a full-width clickable box", () => {
    renderCell(undefined);
    const display = screen.getByText("Empty");
    expect(display.style.display).toBe("block");
    expect(display.style.width).toBe("100%");
    fireEvent.click(display);
    expect(screen.getByLabelText("Due")).toBeTruthy();
  });

  it("omits the Empty placeholder in the grid but stays clickable", () => {
    const { container } = renderCell(undefined, false);
    expect(screen.queryByText("Empty")).toBeNull();
    const display = container.querySelector("p") as HTMLElement;
    expect(display.textContent).toBe("");
    expect(display.style.width).toBe("100%");
    fireEvent.click(display);
    expect(screen.getByLabelText("Due")).toBeTruthy();
  });

  it("commits an ISO date string on selection", () => {
    renderCell(undefined);
    fireEvent.click(screen.getByText("Empty"));
    const input = screen.getByLabelText("Due");
    fireEvent.change(input, { target: { value: "June 1, 2026" } });
    fireEvent.blur(input);
    expect(setMutate).toHaveBeenCalledWith({
      pageId: "page1",
      propertyId: "prop1",
      value: { type: "date", value: "2026-06-01" },
    });
    expect(clearMutate).not.toHaveBeenCalled();
  });

  it("commits on change and does not re-commit on the trailing blur", () => {
    renderCell(undefined);
    fireEvent.click(screen.getByText("Empty"));
    const input = screen.getByLabelText("Due");
    // onChange owns the commit; the input stays open so the user can adjust.
    fireEvent.change(input, { target: { value: "June 1, 2026" } });
    expect(setMutate).toHaveBeenCalledTimes(1);
    expect(setMutate).toHaveBeenCalledWith({
      pageId: "page1",
      propertyId: "prop1",
      value: { type: "date", value: "2026-06-01" },
    });
    // Still editing after a commit (blur, not change, terminates editing).
    expect(screen.queryByLabelText("Due")).not.toBeNull();
    // The trailing blur (Mantine echoes the raw text) must not re-commit.
    fireEvent.blur(input);
    expect(setMutate).toHaveBeenCalledTimes(1);
  });

  it("does not re-fire the mutation when the same date is committed twice", () => {
    renderCell(undefined);
    fireEvent.click(screen.getByText("Empty"));
    const input = screen.getByLabelText("Due");
    fireEvent.change(input, { target: { value: "June 1, 2026" } });
    fireEvent.change(input, { target: { value: "June 1, 2026" } });
    expect(setMutate).toHaveBeenCalledTimes(1);
  });

  it("pre-fills the input with the stored date when editing starts", () => {
    renderCell({ type: "date", value: "2026-06-01" });
    fireEvent.click(screen.getByText("2026-06-01"));
    const input = screen.getByLabelText("Due") as HTMLInputElement;
    expect(input.value).toBe("2026-06-01");
  });

  it("clears the value when emptied", () => {
    renderCell({ type: "date", value: "2026-06-01" });
    fireEvent.click(screen.getByText("2026-06-01"));
    const input = screen.getByLabelText("Due");
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.blur(input);
    expect(clearMutate).toHaveBeenCalledWith({
      pageId: "page1",
      propertyId: "prop1",
    });
    expect(setMutate).not.toHaveBeenCalled();
  });
});
