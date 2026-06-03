import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";

const updateMutate = vi.fn();

vi.mock("@/features/database/queries/database-query.ts", () => ({
  useUpdatePropertyMutation: () => ({ mutate: updateMutate }),
}));

import { SelectOptionsEditor } from "./select-options-editor";
import { IDatabaseProperty } from "@/features/database/types/database.types.ts";

const property: IDatabaseProperty = {
  id: "prop1",
  databaseId: "db1",
  name: "Status",
  type: "select",
  config: {
    options: [
      { id: "o1", label: "Todo", color: "blue" },
      { id: "o2", label: "Doing", color: "green" },
    ],
  },
  position: "a0",
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
};

function renderEditor() {
  return render(
    <MantineProvider>
      <SelectOptionsEditor property={property} databaseId="db1" />
    </MantineProvider>,
  );
}

describe("SelectOptionsEditor", () => {
  beforeEach(() => updateMutate.mockReset());

  function lastConfigOptions() {
    return updateMutate.mock.calls.at(-1)![0].config.options;
  }

  it("renders an input per existing option", () => {
    renderEditor();
    expect((screen.getByDisplayValue("Todo") as HTMLInputElement)).toBeTruthy();
    expect((screen.getByDisplayValue("Doing") as HTMLInputElement)).toBeTruthy();
  });

  it("renames an option via full-replace echo (all ids preserved)", () => {
    renderEditor();
    const input = screen.getByDisplayValue("Todo");
    fireEvent.change(input, { target: { value: "Backlog" } });
    fireEvent.blur(input);
    expect(updateMutate.mock.calls[0][0].propertyId).toBe("prop1");
    expect(lastConfigOptions()).toEqual([
      { id: "o1", label: "Backlog", color: "blue" },
      { id: "o2", label: "Doing", color: "green" },
    ]);
  });

  it("adds a new option keeping the existing ones", () => {
    renderEditor();
    fireEvent.click(screen.getByText("Add option"));
    const opts = lastConfigOptions();
    expect(opts.slice(0, 2)).toEqual(property.config.options);
    expect(opts).toHaveLength(3);
  });

  it("deletes an option, echoing the remaining full array", () => {
    renderEditor();
    fireEvent.click(screen.getByLabelText("Delete Todo"));
    expect(lastConfigOptions()).toEqual([
      { id: "o2", label: "Doing", color: "green" },
    ]);
  });

  it("recolors an option, preserving id and label", () => {
    renderEditor();
    fireEvent.click(screen.getByLabelText("Set Todo color red"));
    expect(lastConfigOptions()).toEqual([
      { id: "o1", label: "Todo", color: "red" },
      { id: "o2", label: "Doing", color: "green" },
    ]);
  });
});
