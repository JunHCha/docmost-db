import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { MemoryRouter } from "react-router-dom";

const pageQuery = vi.fn();

vi.mock("@/features/page/queries/page-query", () => ({
  usePageQuery: () => pageQuery(),
}));
vi.mock("@/features/space/queries/space-query.ts", () => ({
  useGetSpaceBySlugQuery: () => ({ data: { settings: {} } }),
}));
vi.mock("@/features/editor/full-editor", () => ({
  FullEditor: () => <div data-testid="full-editor" />,
}));
vi.mock("@/features/database/components/database-view-container.tsx", () => ({
  DatabaseViewContainer: () => <div data-testid="db-container" />,
}));
vi.mock("@/features/page-history/components/history-modal", () => ({
  default: () => null,
}));
vi.mock("@/features/page/components/header/page-header.tsx", () => ({
  default: () => null,
}));
vi.mock("@/features/database/components/row-properties-panel.tsx", () => ({
  RowPropertiesPanel: () => <div data-testid="row-panel" />,
}));
vi.mock("react-helmet-async", () => ({ Helmet: () => null }));

import Page from "./page";

const basePage = {
  id: "p1",
  slugId: "slug1",
  title: "Doc",
  content: "",
  space: { slug: "my-space" },
  permissions: { canEdit: true },
};

function renderPage() {
  return render(
    <MantineProvider>
      <MemoryRouter initialEntries={["/s/my-space/p/doc-slug1"]}>
        <Page />
      </MemoryRouter>
    </MantineProvider>,
  );
}

describe("Page", () => {
  beforeEach(() => pageQuery.mockReset());

  it("renders the row properties panel alongside the editor for doc pages", () => {
    pageQuery.mockReturnValue({
      data: { ...basePage, pageType: "doc" },
      isLoading: false,
      isError: false,
    });
    renderPage();
    expect(screen.getByTestId("full-editor")).toBeTruthy();
    expect(screen.getByTestId("row-panel")).toBeTruthy();
  });

  it("does not render the row panel for database pages", () => {
    pageQuery.mockReturnValue({
      data: { ...basePage, pageType: "database" },
      isLoading: false,
      isError: false,
    });
    renderPage();
    expect(screen.getByTestId("db-container")).toBeTruthy();
    expect(screen.queryByTestId("row-panel")).toBeNull();
  });
});
