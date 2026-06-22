import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";

const infoQuery = vi.fn();
const propertiesQuery = vi.fn();
const rowsQuery = vi.fn();
const setMutate = vi.fn();
const clearMutate = vi.fn();

vi.mock("@/features/database/queries/database-query.ts", () => ({
  useDatabaseInfoQuery: (pageId: string) => infoQuery(pageId),
  useDatabasePropertiesQuery: (databaseId: string) =>
    propertiesQuery(databaseId),
  useDatabaseRowsQuery: (databaseId: string) => rowsQuery(databaseId),
  useDefaultViewId: () => "v1",
  useSetValueMutation: () => ({ mutate: setMutate }),
  useClearValueMutation: () => ({ mutate: clearMutate }),
}));

import { RowPropertiesPanel } from "./row-properties-panel";

const property = {
  id: "p1",
  databaseId: "db1",
  name: "Status",
  type: "text",
  config: {},
  position: "a0",
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
};

const page = { id: "row1", title: "First", parentPageId: "dbpage1" } as any;

function renderPanel() {
  return render(
    <MantineProvider>
      <RowPropertiesPanel page={page} />
    </MantineProvider>,
  );
}

describe("RowPropertiesPanel", () => {
  beforeEach(() => {
    infoQuery.mockReset();
    propertiesQuery.mockReset();
    rowsQuery.mockReset();
    setMutate.mockReset();
    clearMutate.mockReset();
    // Default: parent page resolves to a database (this is a row page).
    infoQuery.mockReturnValue({
      data: { database: { id: "db1" }, page: {} },
      isLoading: false,
    });
    propertiesQuery.mockReturnValue({ data: [property], isLoading: false });
    rowsQuery.mockReturnValue({
      data: [
        {
          row: page,
          values: [
            {
              id: "v1",
              pageId: "row1",
              propertyId: "p1",
              value: { type: "text", value: "Hello" },
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
        },
      ],
      isLoading: false,
    });
  });

  it("renders nothing when the parent page is not a database", () => {
    infoQuery.mockReturnValue({ data: undefined, isLoading: false });
    const { container } = renderPanel();
    expect(container.querySelector(".mantine-Stack-root")).toBeNull();
    expect(screen.queryByText("Status")).toBeNull();
  });

  it("renders nothing when info resolves with database: null", () => {
    // The parent page exists but is a plain document, so info returns
    // database: null (200, not 404). The panel must stay hidden.
    infoQuery.mockReturnValue({
      data: { database: null, page: {} },
      isLoading: false,
    });
    const { container } = renderPanel();
    expect(container.querySelector(".mantine-Stack-root")).toBeNull();
    expect(screen.queryByText("Status")).toBeNull();
  });

  it("renders nothing when the page has no parent page", () => {
    // Mirrors the query's `enabled: !!pageId` — no parent means no DB lookup.
    infoQuery.mockReturnValue({ data: undefined, isLoading: false });
    const { container } = render(
      <MantineProvider>
        <RowPropertiesPanel page={{ id: "x", parentPageId: null } as any} />
      </MantineProvider>,
    );
    expect(container.querySelector(".mantine-Stack-root")).toBeNull();
  });

  it("looks up the parent database via the parent page id", () => {
    renderPanel();
    expect(infoQuery).toHaveBeenCalledWith("dbpage1");
  });

  it("lists each property name and its current value", () => {
    renderPanel();
    expect(screen.getByText("Status")).toBeTruthy();
    expect(screen.getByText("Hello")).toBeTruthy();
  });

  it("shows the data type icon beside each property label", () => {
    // text property → letter-case glyph from the shared type-icon mapping.
    const { container } = renderPanel();
    expect(
      container.querySelector("svg.tabler-icon-letter-case"),
    ).toBeTruthy();
  });

  it("constrains the panel within the page gutter without overflowing", () => {
    // The panel renders directly inside the editor Container (no horizontal
    // padding), so it must reproduce the same 3rem page gutter the title and
    // body use — otherwise it overhangs the page body width (#72). It must
    // also never push wider than its container.
    const { container } = renderPanel();
    const root = container.querySelector(".mantine-Stack-root") as HTMLElement;
    expect(root).not.toBeNull();
    expect(root.className).toContain("panel");
    expect(root.style.maxWidth).toBe("100%");
  });

  it("passes the row's page id to the cell so edits target this row", () => {
    renderPanel();
    fireEvent.click(screen.getByText("Hello"));
    const input = screen.getByLabelText("Status") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Bye" } });
    fireEvent.blur(input);
    expect(setMutate).toHaveBeenCalledWith({
      pageId: "row1",
      propertyId: "p1",
      value: { type: "text", value: "Bye" },
    });
  });
});
