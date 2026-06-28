import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";

vi.mock("@/features/database/queries/database-query.ts", () => ({
  useDefaultViewId: () => "",
  useDatabaseRowsQuery: () => ({ data: [] }),
}));

import { FilterValueWidget } from "./filter-value-widgets";
import { TemplateEmbedProvider } from "@/features/database/components/template-peek/template-embed-context.tsx";
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

  it("emits undefined (not 0) when the number input is cleared", () => {
    const onChange = vi.fn();
    renderWidget(
      <FilterValueWidget
        property={prop({ type: "number" })}
        op="gte"
        value={42}
        onChange={onChange}
      />,
    );
    const input = screen.getByLabelText("Filter value") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "" } });
    // Number("") === 0 would persist a spurious 0; an empty field must clear.
    expect(onChange).toHaveBeenCalledWith(undefined);
    expect(onChange).not.toHaveBeenCalledWith(0);
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

  // --- Template embed $ref mode (#115) ---

  const ctx = {
    templateProperties: [
      prop({ id: "tp1", name: "Team", type: "relation" }),
      prop({ id: "tp2", name: "Owner", type: "relation" }),
      prop({ id: "tp3", name: "Notes", type: "text" }),
    ],
    getEmbedViews: () => undefined,
    setEmbedViews: vi.fn(),
  };

  function renderInTemplate(node: React.ReactNode) {
    return render(
      <MantineProvider>
        <TemplateEmbedProvider value={ctx}>{node}</TemplateEmbedProvider>
      </MantineProvider>,
    );
  }

  it("does NOT show the value-kind toggle outside a template context", () => {
    renderWidget(
      <FilterValueWidget
        property={prop({
          type: "relation",
          config: { targetDatabaseId: "td" },
        })}
        op="contains"
        value={null}
        onChange={vi.fn()}
      />,
    );
    // No template context => plain relation page picker, no "kind" select.
    expect(screen.queryByLabelText("Filter value kind")).toBeNull();
  });

  it("shows the kind toggle for a relation inside a template context", () => {
    renderInTemplate(
      <FilterValueWidget
        property={prop({
          type: "relation",
          config: { targetDatabaseId: "td" },
        })}
        op="contains"
        value={null}
        onChange={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("textbox", { name: "Filter value kind" }),
    ).toBeTruthy();
  });

  it("emits a templatePropertyRef when a template relation property is picked", () => {
    const onChange = vi.fn();
    renderInTemplate(
      <FilterValueWidget
        property={prop({
          type: "relation",
          config: { targetDatabaseId: "td" },
        })}
        op="contains"
        value={null}
        onChange={onChange}
      />,
    );
    fireEvent.click(
      screen.getByRole("textbox", { name: "Filter value kind" }),
    );
    fireEvent.click(screen.getByText("Template property reference"));
    fireEvent.click(
      screen.getByRole("textbox", { name: "Template property" }),
    );
    // Only relation template properties are offered (Notes/text is excluded).
    expect(screen.queryByText("Notes")).toBeNull();
    fireEvent.click(screen.getByText("Team"));
    expect(onChange).toHaveBeenCalledWith({ templatePropertyRef: "tp1" });
  });

  it("restores the $ref mode and selected property from an existing ref value", () => {
    renderInTemplate(
      <FilterValueWidget
        property={prop({
          type: "relation",
          config: { targetDatabaseId: "td" },
        })}
        op="contains"
        value={{ templatePropertyRef: "tp2" }}
        onChange={vi.fn()}
      />,
    );
    // The kind toggle reads as the reference mode and the property select shows
    // the referenced template property's name.
    expect(screen.getByText("Owner")).toBeTruthy();
  });
});
