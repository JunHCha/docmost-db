import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";

// Relation rows are configurable per test so the relation picker can be
// exercised with real page rows (default: empty).
const dbRowsMock = vi.hoisted(() => ({ rows: [] as unknown[] }));

vi.mock("@/features/database/queries/database-query.ts", () => ({
  useDefaultViewId: () => "",
  useDatabaseRowsQuery: () => ({ data: dbRowsMock.rows }),
}));

vi.mock("@/features/workspace/queries/workspace-query.ts", () => ({
  useWorkspaceMembersQuery: () => ({
    data: {
      items: [
        { id: "u1", name: "Alice", email: "alice@example.com" },
        { id: "u2", name: "Bob", email: "bob@example.com" },
      ],
    },
  }),
}));

import { FilterValueWidget } from "./filter-value-widgets";
import { EmbedHostProvider } from "@/features/database/components/embed-host-context.tsx";
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
  beforeEach(() => {
    dbRowsMock.rows = [];
  });

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
    fireEvent.click(screen.getByRole("combobox", { name: "Filter value" }));
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
    fireEvent.click(screen.getByRole("combobox", { name: "Filter value" }));
    fireEvent.click(screen.getByText("Urgent"));
    expect(onChange).toHaveBeenCalledWith("o2");
  });

  it("renders a member picker for person and emits the picked user id", () => {
    const onChange = vi.fn();
    renderWidget(
      <FilterValueWidget
        property={prop({ type: "person" })}
        op="contains"
        value={null}
        onChange={onChange}
      />,
    );
    // A person filter fills its value from the workspace members, not free text.
    // The trigger is an avatar button (Combobox), not a plain Select input.
    fireEvent.click(screen.getByLabelText("Filter value"));
    fireEvent.click(screen.getByText("Bob"));
    expect(onChange).toHaveBeenCalledWith("u2");
  });

  it("shows the picked member as an avatar chip inside the trigger", () => {
    renderWidget(
      <FilterValueWidget
        property={prop({ type: "person" })}
        op="contains"
        value="u1"
        onChange={vi.fn()}
      />,
    );
    // The picked member renders as an avatar + name inside the trigger button.
    const trigger = screen.getByLabelText("Filter value");
    expect(trigger.textContent).toContain("Alice");
  });

  it("renders a page glyph next to each relation option", () => {
    dbRowsMock.rows = [{ row: { id: "r1", title: "Roadmap", icon: "🚀" } }];
    const onChange = vi.fn();
    renderWidget(
      <FilterValueWidget
        property={prop({ type: "relation", config: { targetDatabaseId: "td" } })}
        op="contains"
        value={null}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole("combobox", { name: "Filter value" }));
    // The option lists the page title alongside its emoji glyph (PageGlyph).
    expect(screen.getByText("Roadmap")).toBeTruthy();
    expect(screen.getByText("🚀")).toBeTruthy();
    fireEvent.click(screen.getByText("Roadmap"));
    expect(onChange).toHaveBeenCalledWith("r1");
  });

  // --- Live self-reference: "this page" for relation filters in an embed ---

  const relationProp = prop({
    type: "relation",
    config: { targetDatabaseId: "td" },
  });

  function renderInEmbed(node: React.ReactNode, hostPageId = "host-1") {
    return render(
      <MantineProvider>
        <EmbedHostProvider value={{ hostPageId }}>{node}</EmbedHostProvider>
      </MantineProvider>,
    );
  }

  it("does NOT offer 'this page' for a relation filter outside an embed", () => {
    renderWidget(
      <FilterValueWidget
        property={relationProp}
        op="contains"
        value={null}
        onChange={vi.fn()}
      />,
    );
    expect(screen.queryByLabelText("Filter value kind")).toBeNull();
  });

  it("offers the value-kind toggle for a relation filter inside an embed", () => {
    renderInEmbed(
      <FilterValueWidget
        property={relationProp}
        op="contains"
        value={null}
        onChange={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("combobox", { name: "Filter value kind" }),
    ).toBeTruthy();
  });

  it("emits the { thisPage } symbol when 'This page' is picked", () => {
    const onChange = vi.fn();
    renderInEmbed(
      <FilterValueWidget
        property={relationProp}
        op="contains"
        value={null}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole("combobox", { name: "Filter value kind" }));
    fireEvent.click(screen.getByText("This page"));
    expect(onChange).toHaveBeenCalledWith({ thisPage: true });
  });

  it("starts in 'this page' mode and hides the page picker for a thisPage value", () => {
    renderInEmbed(
      <FilterValueWidget
        property={relationProp}
        op="contains"
        value={{ thisPage: true }}
        onChange={vi.fn()}
      />,
    );
    // Only the kind toggle is present — the relation page picker is hidden.
    const selects = screen.getAllByRole("combobox");
    expect(selects).toHaveLength(1);
    expect(selects[0].getAttribute("aria-label")).toBe("Filter value kind");
  });
});
