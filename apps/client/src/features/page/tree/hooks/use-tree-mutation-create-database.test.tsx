import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { Provider, createStore } from "jotai";

const navigate = vi.fn();
const emit = vi.fn();
const createDatabaseMock = vi.fn();

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: () => navigate,
    useParams: () => ({ spaceSlug: "myspace" }),
  };
});

vi.mock("@/features/websocket/use-query-emit.ts", () => ({
  useQueryEmit: () => emit,
}));

vi.mock("@/features/database/queries/database-query.ts", () => ({
  useCreateDatabaseMutation: () => ({
    mutateAsync: (data: any) => createDatabaseMock(data),
  }),
}));

// Avoid pulling in page-query side effects (queryClient from main.tsx).
vi.mock("@/features/page/queries/page-query.ts", () => ({
  useCreatePageMutation: () => ({ mutateAsync: vi.fn() }),
  useRemovePageMutation: () => ({ mutateAsync: vi.fn() }),
  useMovePageMutation: () => ({ mutateAsync: vi.fn() }),
  useUpdatePageMutation: () => ({ mutateAsync: vi.fn() }),
  updateCacheOnMovePage: vi.fn(),
}));

import { useTreeMutation } from "./use-tree-mutation";
import { treeDataAtom } from "@/features/page/tree/atoms/tree-data-atom.ts";
import { treeModel } from "@/features/page/tree/model/tree-model";

function wrapper(store: ReturnType<typeof createStore>) {
  const queryClient = new QueryClient();
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <Provider store={store}>
          <MemoryRouter>{children}</MemoryRouter>
        </Provider>
      </QueryClientProvider>
    );
  };
}

describe("useTreeMutation handleCreateDatabase", () => {
  beforeEach(() => {
    navigate.mockReset();
    emit.mockReset();
    createDatabaseMock.mockReset();
  });

  it("creates a database, inserts a database tree node, and navigates", async () => {
    const store = createStore();
    store.set(treeDataAtom, []);

    createDatabaseMock.mockResolvedValue({
      database: { id: "db1" },
      page: {
        id: "page1",
        slugId: "slug1",
        title: "Tasks",
        position: "a0",
        spaceId: "s1",
        parentPageId: null,
      },
    });

    const { result } = renderHook(() => useTreeMutation("s1"), {
      wrapper: wrapper(store),
    });

    await act(async () => {
      await result.current.handleCreateDatabase(null);
    });

    expect(createDatabaseMock).toHaveBeenCalledWith({ spaceId: "s1" });

    const tree = store.get(treeDataAtom);
    const node = treeModel.find(tree, "page1");
    expect(node).toBeTruthy();
    expect(node?.pageType).toBe("database");

    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate.mock.calls[0][0]).toContain("slug1");
  });

  it("inserts the database node under the given parent", async () => {
    const store = createStore();
    store.set(treeDataAtom, [
      {
        id: "parent1",
        slugId: "pslug",
        name: "Parent",
        position: "a0",
        spaceId: "s1",
        parentPageId: null,
        hasChildren: true,
        children: [],
      },
    ]);

    createDatabaseMock.mockResolvedValue({
      database: { id: "db1" },
      page: {
        id: "child-db",
        slugId: "cslug",
        title: "Nested DB",
        position: "a1",
        spaceId: "s1",
        parentPageId: "parent1",
      },
    });

    const { result } = renderHook(() => useTreeMutation("s1"), {
      wrapper: wrapper(store),
    });

    await act(async () => {
      await result.current.handleCreateDatabase("parent1");
    });

    expect(createDatabaseMock).toHaveBeenCalledWith({
      spaceId: "s1",
      parentPageId: "parent1",
    });

    const parent = treeModel.find(store.get(treeDataAtom), "parent1");
    const child = parent?.children?.find((n) => n.id === "child-db");
    expect(child).toBeTruthy();
    expect(child?.pageType).toBe("database");
  });

  it("does not insert a node when database creation fails", async () => {
    const store = createStore();
    store.set(treeDataAtom, []);
    createDatabaseMock.mockRejectedValue(new Error("boom"));

    const { result } = renderHook(() => useTreeMutation("s1"), {
      wrapper: wrapper(store),
    });

    await expect(
      act(async () => {
        await result.current.handleCreateDatabase(null);
      }),
    ).rejects.toThrow("Failed to create database");

    expect(store.get(treeDataAtom)).toEqual([]);
    expect(navigate).not.toHaveBeenCalled();
  });
});
