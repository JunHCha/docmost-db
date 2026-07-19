import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import dayjs from "dayjs";

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

function renderCell(value: any, showEmptyPlaceholder = true, onChange?: any) {
  return render(
    <MantineProvider>
      <DateCell
        property={property}
        value={value}
        pageId={onChange ? "" : "page1"}
        databaseId="db1"
        showEmptyPlaceholder={showEmptyPlaceholder}
        onChange={onChange}
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

  it("renders an empty value as a full-width clickable box that opens one dropdown", () => {
    renderCell(undefined);
    const display = screen.getByText("Empty");
    expect(display.style.display).toBe("block");
    expect(display.style.width).toBe("100%");
    fireEvent.click(display);
    // A single dropdown hosts BOTH the quick shortcuts and the calendar: the
    // "Today" shortcut and a calendar day ("15" is unique in a month grid).
    expect(screen.getByText("Today")).toBeTruthy();
    expect(screen.getByText("15")).toBeTruthy();
  });

  it("omits the Empty placeholder in the grid but stays clickable", () => {
    const { container } = renderCell(undefined, false);
    expect(screen.queryByText("Empty")).toBeNull();
    const display = container.querySelector("p") as HTMLElement;
    expect(display.textContent).toBe("");
    expect(display.style.width).toBe("100%");
    fireEvent.click(display);
    expect(screen.getByText("Today")).toBeTruthy();
  });

  it("commits an ISO date picked from the calendar", () => {
    renderCell(undefined);
    fireEvent.click(screen.getByText("Empty"));
    // Exactly one "15" is rendered for the visible (current) month.
    fireEvent.click(screen.getByText("15"));
    expect(setMutate).toHaveBeenCalledWith({
      pageId: "page1",
      propertyId: "prop1",
      value: { type: "date", value: dayjs().date(15).format("YYYY-MM-DD") },
    });
    expect(clearMutate).not.toHaveBeenCalled();
    // Picking closes the single dropdown.
    expect(screen.queryByText("Today")).toBeNull();
  });

  it("opens the calendar on the stored month", () => {
    renderCell({ type: "date", value: "2026-06-01" });
    fireEvent.click(screen.getByText("2026-06-01"));
    // The calendar navigates to the stored value's month.
    expect(screen.getByText("June 2026")).toBeTruthy();
  });

  it("clears the value via the Clear button", () => {
    renderCell({ type: "date", value: "2026-06-01" });
    fireEvent.click(screen.getByText("2026-06-01"));
    fireEvent.click(screen.getByText("Clear"));
    expect(clearMutate).toHaveBeenCalledWith({
      pageId: "page1",
      propertyId: "prop1",
    });
    expect(setMutate).not.toHaveBeenCalled();
  });

  it("does not offer Clear when there is no stored value", () => {
    renderCell(undefined);
    fireEvent.click(screen.getByText("Empty"));
    expect(screen.queryByText("Clear")).toBeNull();
  });

  describe("quick picks", () => {
    it("commits today's date via the Today quick pick", () => {
      renderCell(undefined);
      fireEvent.click(screen.getByText("Empty"));
      fireEvent.click(screen.getByText("Today"));
      expect(setMutate).toHaveBeenCalledWith({
        pageId: "page1",
        propertyId: "prop1",
        value: { type: "date", value: dayjs().format("YYYY-MM-DD") },
      });
    });

    it("commits a 1-day offset via the '1 day later' quick pick", () => {
      renderCell(undefined);
      fireEvent.click(screen.getByText("Empty"));
      fireEvent.click(screen.getByText("1 day later"));
      expect(setMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          value: {
            type: "date",
            value: dayjs().add(1, "day").format("YYYY-MM-DD"),
          },
        }),
      );
    });

    it("commits a next-week offset via the 'Next week' quick pick", () => {
      renderCell(undefined);
      fireEvent.click(screen.getByText("Empty"));
      fireEvent.click(screen.getByText("Next week"));
      expect(setMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          value: {
            type: "date",
            value: dayjs().add(1, "week").format("YYYY-MM-DD"),
          },
        }),
      );
    });

    it("does not re-fire the mutation when the same date is picked twice", () => {
      renderCell(undefined);
      fireEvent.click(screen.getByText("Empty"));
      fireEvent.click(screen.getByText("Today"));
      // Reopen and pick the same day again — the last-committed guard blocks it.
      fireEvent.click(screen.getByText("Empty"));
      fireEvent.click(screen.getByText("Today"));
      expect(setMutate).toHaveBeenCalledTimes(1);
    });

    it("controlled: a quick pick emits onChange without a mutation", () => {
      const onChange = vi.fn();
      renderCell(undefined, true, onChange);
      fireEvent.click(screen.getByText("Empty"));
      fireEvent.click(screen.getByText("2 days later"));
      expect(onChange).toHaveBeenCalledWith({
        type: "date",
        value: dayjs().add(2, "day").format("YYYY-MM-DD"),
      });
      expect(setMutate).not.toHaveBeenCalled();
    });

    it("controlled: Clear emits onChange(undefined), no mutation", () => {
      const onChange = vi.fn();
      renderCell({ type: "date", value: "2026-06-01" }, true, onChange);
      fireEvent.click(screen.getByText("2026-06-01"));
      fireEvent.click(screen.getByText("Clear"));
      expect(onChange).toHaveBeenCalledWith(undefined);
      expect(clearMutate).not.toHaveBeenCalled();
    });
  });
});
