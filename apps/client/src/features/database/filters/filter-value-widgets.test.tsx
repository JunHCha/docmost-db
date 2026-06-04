import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";

vi.mock("@/features/database/queries/database-query.ts", () => ({
  useDefaultViewId: () => "",
  useDatabaseRowsQuery: () => ({ data: [] }),
}));

import { FilterValueWidget } from "./filter-value-widgets";
import { IDatabaseProperty } from "@/features/database/types/database.types.ts";

function prop(over: Partial<IDatabaseProperty>): IDatabaseProperty {
  return {
    id: "p1",
    databaseId: "db1",
    name: "Field",
    type: "text",
    config: {},
    position: "a0",
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...over,
  };
}

function renderWidget(node: React.ReactNode) {
  return render(<MantineProvider>{node}</MantineProvider>);
}

describe("FilterValueWidget", () => {
  it("hides the widget for empty ops", () => {
    const { container } = renderWidget(
      <FilterValueWidget
        property={prop({ type: "text" })}
        op="is_empty"
        value={undefined}
        onChange={vi.fn()}
      />,
    );
    expect(container.querySelector("input")).toBeNull();
  });

  it("renders a text input for text/url and emits raw string", () => {
    const onChange = vi.fn();
    renderWidget(
      <FilterValueWidget
        property={prop({ type: "text" })}
        op="contains"
        value=""
        onChange={onChange}
      />,
    );
    const input = screen.getByLabelText("Filter value") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "abc" } });
    expect(onChange).toHaveBeenCalledWith("abc");
  });

  it("renders a number input for number and emits a number", () => {
    const onChange = vi.fn();
    renderWidget(
      <FilterValueWidget
        property={prop({ type: "number" })}
        op="gte"
        value={null}
        onChange={onChange}
      />,
    );
    const input = screen.getByLabelText("Filter value") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "42" } });
    expect(onChange).toHaveBeenCalledWith(42);
  });

  it("renders a date input for date", () => {
    renderWidget(
      <FilterValueWidget
        property={prop({ type: "date" })}
        op="lt"
        value=""
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("Filter value")).toBeTruthy();
  });

  it("renders a select of options for select and emits the option id", () => {
    const onChange = vi.fn();
    renderWidget(
      <FilterValueWidget
        property={prop({
          type: "select",
          config: { options: [{ id: "o1", label: "Done" }] },
        })}
        op="eq"
        value={null}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole("textbox", { name: "Filter value" }));
    fireEvent.click(screen.getByText("Done"));
    expect(onChange).toHaveBeenCalledWith("o1");
  });

  it("renders a checked/unchecked toggle for checkbox", () => {
    const onChange = vi.fn();
    renderWidget(
      <FilterValueWidget
        property={prop({ type: "checkbox" })}
        op="eq"
        value={false}
        onChange={onChange}
      />,
    );
    const box = screen.getByLabelText("Filter value") as HTMLInputElement;
    fireEvent.click(box);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("renders a multi-option select for multi_select emitting an option id", () => {
    const onChange = vi.fn();
    renderWidget(
      <FilterValueWidget
        property={prop({
          type: "multi_select",
          config: { options: [{ id: "o2", label: "Urgent" }] },
        })}
        op="contains"
        value={null}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole("textbox", { name: "Filter value" }));
    fireEvent.click(screen.getByText("Urgent"));
    expect(onChange).toHaveBeenCalledWith("o2");
  });
});
