import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Provider, createStore } from "jotai";

// ── mocks ────────────────────────────────────────────────────────────────────

const patchRowTitleEverywhereMock = vi.fn();

vi.mock("@/features/database/queries/database-cache", () => ({
  patchRowTitleEverywhere: (...args: any[]) =>
    patchRowTitleEverywhereMock(...args),
}));

// We supply our own queryClient below; mock main.tsx to avoid side effects.
vi.mock("@/main", () => ({
  queryClient: null,
}));

// Capture the localEmitter so we can emit events in tests.
import localEmitter from "@/lib/local-emitter.ts";
import { socketAtom } from "@/features/websocket/atoms/socket-atom.ts";

// ── helper ───────────────────────────────────────────────────────────────────

function wrapper(
  store: ReturnType<typeof createStore>,
  qc: QueryClient,
) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={qc}>
        <Provider store={store}>{children}</Provider>
      </QueryClientProvider>
    );
  };
}

// ── import subject after mocks are set up ────────────────────────────────────

import { useDatabaseRowTitleSync } from "./use-database-row-title-sync";

// ── tests ────────────────────────────────────────────────────────────────────

describe("useDatabaseRowTitleSync", () => {
  let store: ReturnType<typeof createStore>;
  let qc: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    store = createStore();
    qc = new QueryClient();
  });

  it("calls patchRowTitleEverywhere when localEmitter emits an updateOne pages event with a title", () => {
    renderHook(() => useDatabaseRowTitleSync(), {
      wrapper: wrapper(store, qc),
    });

    act(() => {
      localEmitter.emit("message", {
        operation: "updateOne",
        entity: ["pages"],
        id: "page1",
        payload: { title: "New Title" },
      });
    });

    expect(patchRowTitleEverywhereMock).toHaveBeenCalledTimes(1);
    expect(patchRowTitleEverywhereMock).toHaveBeenCalledWith(
      expect.anything(),
      "page1",
      "New Title",
    );
  });

  it("does not call patch when payload has no title", () => {
    renderHook(() => useDatabaseRowTitleSync(), {
      wrapper: wrapper(store, qc),
    });

    act(() => {
      localEmitter.emit("message", {
        operation: "updateOne",
        entity: ["pages"],
        id: "page1",
        payload: { icon: "🎉" },
      });
    });

    expect(patchRowTitleEverywhereMock).not.toHaveBeenCalled();
  });

  it("does not call patch when operation is not updateOne", () => {
    renderHook(() => useDatabaseRowTitleSync(), {
      wrapper: wrapper(store, qc),
    });

    act(() => {
      localEmitter.emit("message", {
        operation: "addTreeNode",
        entity: ["pages"],
        id: "page1",
        payload: { title: "New Title" },
      });
    });

    expect(patchRowTitleEverywhereMock).not.toHaveBeenCalled();
  });

  it("does not call patch when entity is not pages", () => {
    renderHook(() => useDatabaseRowTitleSync(), {
      wrapper: wrapper(store, qc),
    });

    act(() => {
      localEmitter.emit("message", {
        operation: "updateOne",
        entity: ["spaces"],
        id: "s1",
        payload: { title: "New Title" },
      });
    });

    expect(patchRowTitleEverywhereMock).not.toHaveBeenCalled();
  });

  it("removes the localEmitter listener on unmount", () => {
    const { unmount } = renderHook(() => useDatabaseRowTitleSync(), {
      wrapper: wrapper(store, qc),
    });

    unmount();

    act(() => {
      localEmitter.emit("message", {
        operation: "updateOne",
        entity: ["pages"],
        id: "page1",
        payload: { title: "After unmount" },
      });
    });

    expect(patchRowTitleEverywhereMock).not.toHaveBeenCalled();
  });

  it("calls patchRowTitleEverywhere when socket emits an updateOne pages event with a title", () => {
    // Set up a mock socket with on/off
    const handlers: Record<string, ((...args: any[]) => void)[]> = {};
    const mockSocket = {
      on: (event: string, handler: (...args: any[]) => void) => {
        handlers[event] = handlers[event] ?? [];
        handlers[event].push(handler);
      },
      off: (event: string, handler: (...args: any[]) => void) => {
        if (handlers[event]) {
          handlers[event] = handlers[event].filter((h) => h !== handler);
        }
      },
    };
    // socketAtom is a writable PrimitiveAtom; cast to bypass the jotai
    // overload ambiguity that tsc resolves as Atom<> (read-only) instead of
    // WritableAtom<> when the inferred type is a union containing null.
    store.set(socketAtom as any, mockSocket as any);

    renderHook(() => useDatabaseRowTitleSync(), {
      wrapper: wrapper(store, qc),
    });

    act(() => {
      handlers["message"]?.forEach((h) =>
        h({
          operation: "updateOne",
          entity: ["pages"],
          id: "page2",
          payload: { title: "Socket Title" },
        }),
      );
    });

    expect(patchRowTitleEverywhereMock).toHaveBeenCalledWith(
      expect.anything(),
      "page2",
      "Socket Title",
    );
  });
});
