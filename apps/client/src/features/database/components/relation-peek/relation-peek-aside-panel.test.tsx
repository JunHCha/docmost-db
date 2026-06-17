import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { MemoryRouter } from "react-router-dom";
import { Provider, createStore } from "jotai";
import { pagePeekAtom } from "@/features/database/atoms/page-peek-atom.ts";

vi.mock("./relation-page-peek.tsx", () => ({
  RelationPagePeek: ({ pageId }: { pageId: string }) => (
    <div data-testid="peek-body">{pageId}</div>
  ),
}));

vi.mock("@/features/page/queries/page-query.ts", () => ({
  usePageQuery: () => ({
    data: { id: "p1", slugId: "p1", title: "Alpha", space: { slug: "s" } },
  }),
}));

import { RelationPeekAsidePanel } from "./relation-peek-aside-panel.tsx";

function renderWithState(state: {
  pageId: string | null;
  host: "aside" | "modal";
}) {
  const store = createStore();
  store.set(pagePeekAtom, state);
  return render(
    <MantineProvider>
      <MemoryRouter>
        <Provider store={store}>
          <RelationPeekAsidePanel />
        </Provider>
      </MemoryRouter>
    </MantineProvider>,
  );
}

describe("RelationPeekAsidePanel", () => {
  it("renders the overlay peek when the aside host is active", () => {
    renderWithState({ pageId: "p1", host: "aside" });
    expect(screen.getByTestId("peek-body").textContent).toBe("p1");
  });

  it("renders nothing for the modal host", () => {
    renderWithState({ pageId: "p1", host: "modal" });
    expect(screen.queryByTestId("peek-body")).toBeNull();
  });

  it("renders nothing when no page is open", () => {
    renderWithState({ pageId: null, host: "aside" });
    expect(screen.queryByTestId("peek-body")).toBeNull();
  });
});
