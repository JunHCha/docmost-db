import { describe, it, expect, beforeEach } from "vitest";
import { render, renderHook, screen, act } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { MemoryRouter } from "react-router-dom";
import { Provider, createStore, useAtomValue } from "jotai";
import { vi } from "vitest";
import { pagePeekAtom } from "@/features/database/atoms/page-peek-atom.ts";

// The peek body mounts the real collaborative editor — stub it so these tests
// stay focused on host/open/close behaviour.
vi.mock("./relation-page-peek.tsx", () => ({
  RelationPagePeek: ({ pageId }: { pageId: string }) => (
    <div data-testid="peek-body">{pageId}</div>
  ),
}));

// The header controls fetch the page for the "open as page" action.
vi.mock("@/features/page/queries/page-query.ts", () => ({
  usePageQuery: () => ({
    data: { id: "p9", slugId: "p9", title: "Alpha", space: { slug: "s" } },
  }),
}));

import { usePagePeek } from "./use-page-peek.tsx";
import { RelationPeekModalHost } from "./relation-peek-host.tsx";

function hookWithStore() {
  const store = createStore();
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );
  const view = renderHook(
    () => ({
      peek: usePagePeek(),
      raw: useAtomValue(pagePeekAtom),
    }),
    { wrapper },
  );
  return { store, ...view };
}

describe("usePagePeek", () => {
  it("opens in the aside host by default", () => {
    const { result } = hookWithStore();
    act(() => result.current.peek.open("p1"));
    expect(result.current.raw.pageId).toBe("p1");
    expect(result.current.raw.host).toBe("aside");
  });

  it("switches the host without losing the page", () => {
    const { result } = hookWithStore();
    act(() => result.current.peek.open("p1"));
    act(() => result.current.peek.setHost("modal"));
    expect(result.current.raw.host).toBe("modal");
    expect(result.current.raw.pageId).toBe("p1");
  });

  it("close clears the previewed page", () => {
    const { result } = hookWithStore();
    act(() => result.current.peek.open("p1"));
    act(() => result.current.peek.close());
    expect(result.current.raw.pageId).toBeNull();
  });
});

describe("RelationPeekModalHost", () => {
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
            <RelationPeekModalHost />
          </Provider>
        </MemoryRouter>
      </MantineProvider>,
    );
  }

  beforeEach(() => {
    // jsdom lacks ResizeObserver, which Mantine Modal touches.
    // @ts-ignore
    globalThis.ResizeObserver ||= class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });

  it("renders the peek body in a modal when the modal host is active", () => {
    renderWithState({ pageId: "p9", host: "modal" });
    expect(screen.getByTestId("peek-body").textContent).toBe("p9");
  });

  it("renders nothing when the aside host is active", () => {
    renderWithState({ pageId: "p9", host: "aside" });
    expect(screen.queryByTestId("peek-body")).toBeNull();
  });
});
