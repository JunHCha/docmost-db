import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import {
  databasePropertiesKey,
  databaseViewsKey,
} from "./database-cache.ts";

const { queryClient } = await vi.hoisted(async () => {
  const { QueryClient: QC } = await import("@tanstack/react-query");
  return {
    queryClient: new QC({
      defaultOptions: {
        mutations: { retry: false },
        queries: { retry: false },
      },
    }),
  };
});

vi.mock("@/main.tsx", () => ({ queryClient }));

vi.mock("@mantine/notifications", () => ({
  notifications: { show: vi.fn() },
}));

const invalidateOnCreatePage = vi.fn();
vi.mock("@/features/page/queries/page-query.ts", () => ({
  invalidateOnCreatePage: (...a: unknown[]) => invalidateOnCreatePage(...a),
  updatePageData: vi.fn(),
}));

const appendRow = vi.fn();
vi.mock("@/features/database/queries/database-cache.ts", async () => {
  const actual = await vi.importActual<
    typeof import("./database-cache.ts")
  >("./database-cache.ts");
  return { ...actual, appendRow: (...a: unknown[]) => appendRow(...a) };
});

const service = {
  setValue: vi.fn(),
  clearValue: vi.fn(),
  createRow: vi.fn(),
  deleteRows: vi.fn(),
  listRows: vi.fn(),
  createProperty: vi.fn(),
  updateProperty: vi.fn(),
  deleteProperty: vi.fn(),
  reorderProperty: vi.fn(),
  listDatabases: vi.fn(),
  createView: vi.fn(),
  updateView: vi.fn(),
  setDefaultView: vi.fn(),
  deleteView: vi.fn(),
  getDatabaseInfo: vi.fn(),
  listViews: vi.fn(),
};

vi.mock("@/features/database/services/database-service.ts", () => ({
  setValue: (...a: unknown[]) => service.setValue(...a),
  clearValue: (...a: unknown[]) => service.clearValue(...a),
  createRow: (...a: unknown[]) => service.createRow(...a),
  createProperty: (...a: unknown[]) => service.createProperty(...a),
  updateProperty: (...a: unknown[]) => service.updateProperty(...a),
  deleteProperty: (...a: unknown[]) => service.deleteProperty(...a),
  reorderProperty: (...a: unknown[]) => service.reorderProperty(...a),
  createDatabase: vi.fn(),
  getDatabaseInfo: (...a: unknown[]) => service.getDatabaseInfo(...a),
  listProperties: vi.fn(),
  listRows: (...a: unknown[]) => service.listRows(...a),
  deleteRows: (...a: unknown[]) => service.deleteRows(...a),
  listDatabases: (...a: unknown[]) => service.listDatabases(...a),
  listViews: (...a: unknown[]) => service.listViews(...a),
  createView: (...a: unknown[]) => service.createView(...a),
  updateView: (...a: unknown[]) => service.updateView(...a),
  setDefaultView: (...a: unknown[]) => service.setDefaultView(...a),
  deleteView: (...a: unknown[]) => service.deleteView(...a),
}));

import {
  useClearValueMutation,
  useCreatePropertyMutation,
  useCreateRowMutation,
  useCreateViewMutation,
  useDatabaseInfoByIdQuery,
  useDatabaseRowsQuery,
  useDatabaseViewsQuery,
  useDeletePropertyMutation,
  useDeleteRowsMutation,
  useListDatabasesQuery,
  useReorderPropertyMutation,
  useSetDefaultViewMutation,
  useSetValueMutation,
  useUpdatePropertyMutation,
  useUpdateViewMutation,
} from "./database-query.ts";
import {
  databaseInfoByIdKey,
  databaseRowsKey,
  databasesKey,
} from "./database-cache.ts";
import { IDatabaseRow } from "@/features/database/types/database.types.ts";
import { DatabaseCollabContext } from "@/features/database/hooks/database-collab-context";

const dbId = "db1";

function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("database mutations resync the cache on error", () => {
  let invalidate: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    Object.values(service).forEach((fn) => {
      fn.mockReset();
      fn.mockRejectedValue(new Error("boom"));
    });
    invalidate = vi
      .spyOn(queryClient, "invalidateQueries")
      .mockResolvedValue(undefined as never);
  });

  it("setValue invalidates the rows query on error", async () => {
    const { result } = renderHook(() => useSetValueMutation(dbId), { wrapper });
    result.current.mutate({} as never);
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ["database-rows", dbId],
    });
  });

  it("clearValue invalidates the rows query on error", async () => {
    const { result } = renderHook(() => useClearValueMutation(dbId), {
      wrapper,
    });
    result.current.mutate({} as never);
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ["database-rows", dbId],
    });
  });

  it("createRow invalidates the rows query on error", async () => {
    const { result } = renderHook(() => useCreateRowMutation(dbId), {
      wrapper,
    });
    result.current.mutate({} as never);
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ["database-rows", dbId],
    });
  });

  it("createProperty invalidates the properties query on error", async () => {
    const { result } = renderHook(() => useCreatePropertyMutation(dbId), {
      wrapper,
    });
    result.current.mutate({} as never);
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: databasePropertiesKey(dbId),
    });
  });

  it("updateProperty invalidates the properties query on error", async () => {
    const { result } = renderHook(() => useUpdatePropertyMutation(dbId), {
      wrapper,
    });
    result.current.mutate({} as never);
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: databasePropertiesKey(dbId),
    });
  });

  it("deleteProperty invalidates the properties query on error", async () => {
    const { result } = renderHook(() => useDeletePropertyMutation(dbId), {
      wrapper,
    });
    result.current.mutate({} as never);
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: databasePropertiesKey(dbId),
    });
  });

  it("reorderProperty invalidates the properties query on error", async () => {
    const { result } = renderHook(() => useReorderPropertyMutation(dbId), {
      wrapper,
    });
    result.current.mutate({} as never);
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: databasePropertiesKey(dbId),
    });
  });
});

describe("useCreateRowMutation success path", () => {
  beforeEach(() => {
    Object.values(service).forEach((fn) => fn.mockReset());
    appendRow.mockReset();
    invalidateOnCreatePage.mockReset();
  });

  it("appends the row to the grid cache but does not expose it in the sidebar", async () => {
    const page = { id: "row1", title: "" };
    service.createRow.mockResolvedValue(page);
    const { result } = renderHook(() => useCreateRowMutation(dbId), { wrapper });
    result.current.mutate({ databaseId: dbId } as never);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(appendRow).toHaveBeenCalled();
    // Rows are not surfaced as sidebar child pages (Notion-like), so the
    // sidebar create cache must not be touched.
    expect(invalidateOnCreatePage).not.toHaveBeenCalled();
  });
});

describe("useDatabaseInfoByIdQuery", () => {
  beforeEach(() => {
    Object.values(service).forEach((fn) => fn.mockReset());
    queryClient.clear();
  });

  it("looks up the database by databaseId under its own info key", async () => {
    const info = { database: { id: "db1" }, page: { id: "p1" } };
    service.getDatabaseInfo.mockResolvedValue(info);

    const { result } = renderHook(() => useDatabaseInfoByIdQuery("db1"), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    // Resolves by databaseId (the embed only carries the database id), not pageId.
    expect(service.getDatabaseInfo).toHaveBeenCalledWith({ databaseId: "db1" });
    expect(result.current.data).toBe(info);
    expect(queryClient.getQueryData(databaseInfoByIdKey("db1"))).toBe(info);
  });

  it("is disabled without a databaseId", () => {
    const { result } = renderHook(() => useDatabaseInfoByIdQuery(""), {
      wrapper,
    });
    expect(result.current.fetchStatus).toBe("idle");
    expect(service.getDatabaseInfo).not.toHaveBeenCalled();
  });
});

describe("useListDatabasesQuery", () => {
  beforeEach(() => {
    Object.values(service).forEach((fn) => fn.mockReset());
    queryClient.clear();
  });

  it("queries databases for a space under the ['databases', spaceId] key", async () => {
    const list = [{ id: "db1", pageId: "p1", title: "Tasks", icon: null }];
    service.listDatabases.mockResolvedValue(list);

    const { result } = renderHook(() => useListDatabasesQuery("space-1"), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(service.listDatabases).toHaveBeenCalledWith({ spaceId: "space-1" });
    expect(result.current.data).toBe(list);
    expect(
      queryClient.getQueryData(databasesKey("space-1")),
    ).toBe(list);
  });

  it("is disabled without a spaceId", () => {
    const { result } = renderHook(() => useListDatabasesQuery(""), { wrapper });
    expect(result.current.fetchStatus).toBe("idle");
    expect(service.listDatabases).not.toHaveBeenCalled();
  });
});

describe("useUpdatePropertyMutation success path", () => {
  let invalidateSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    Object.values(service).forEach((fn) => fn.mockReset());
    service.updateProperty.mockResolvedValue({ id: "prop1", type: "text" });
    invalidateSpy = vi
      .spyOn(queryClient, "invalidateQueries")
      .mockResolvedValue(undefined as never);
  });
  afterEach(() => invalidateSpy.mockRestore());

  it("refetches rows on a type change (values may be migrated server-side)", async () => {
    const { result } = renderHook(() => useUpdatePropertyMutation(dbId), {
      wrapper,
    });
    result.current.mutate({ propertyId: "prop1", type: "text" } as never);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["database-rows", dbId],
    });
  });

  it("does not refetch rows when only the name changes", async () => {
    const { result } = renderHook(() => useUpdatePropertyMutation(dbId), {
      wrapper,
    });
    result.current.mutate({ propertyId: "prop1", name: "Renamed" } as never);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).not.toHaveBeenCalledWith({
      queryKey: ["database-rows", dbId],
    });
  });
});

describe("useDatabaseRowsQuery passes the view's filters/sorts", () => {
  beforeEach(() => {
    Object.values(service).forEach((fn) => fn.mockReset());
    queryClient.clear();
  });

  it("forwards config filters/sorts to the listRows request body", async () => {
    service.listRows.mockResolvedValue([]);
    const config = {
      filters: [{ propertyId: "p1", op: "eq", value: "x" }],
      sorts: [{ propertyId: "p2", direction: "desc" }],
    } as never;

    const { result } = renderHook(
      () => useDatabaseRowsQuery(dbId, "v1", config),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(service.listRows).toHaveBeenCalledWith({
      databaseId: dbId,
      filters: [{ propertyId: "p1", op: "eq", value: "x" }],
      sorts: [{ propertyId: "p2", direction: "desc" }],
    });
  });

  it("caches each view's rows under its own viewId key", async () => {
    service.listRows.mockResolvedValue([]);
    renderHook(() => useDatabaseRowsQuery(dbId, "v1"), { wrapper });
    renderHook(() => useDatabaseRowsQuery(dbId, "v2"), { wrapper });
    await waitFor(() =>
      expect(service.listRows).toHaveBeenCalledTimes(2),
    );
    // Distinct query keys => independent cache slots per view.
    expect(databaseRowsKey(dbId, "v1")).not.toEqual(
      databaseRowsKey(dbId, "v2"),
    );
  });

  it("refetches and caches a separate slot when the filter changes (Critical regression)", async () => {
    // Real QueryClient with the production staleTime/refetch defaults — proves a
    // filter change forces a fresh listRows call and a distinct cache slot
    // (without the config in the queryKey React Query would serve the stale
    // unfiltered result for the same viewId).
    const qc = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          refetchOnMount: false,
          refetchOnWindowFocus: false,
          staleTime: 5 * 60 * 1000,
        },
      },
    });
    function localWrapper({ children }: { children: ReactNode }) {
      return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
    }
    service.listRows.mockResolvedValue([]);

    const noFilter = { filters: [], sorts: [] } as never;
    const withFilter = {
      filters: [{ propertyId: "p1", op: "eq", value: "x" }],
      sorts: [],
    } as never;

    const { rerender } = renderHook(
      ({ config }: { config: never }) =>
        useDatabaseRowsQuery(dbId, "v1", config),
      { wrapper: localWrapper, initialProps: { config: noFilter } },
    );
    await waitFor(() => expect(service.listRows).toHaveBeenCalledTimes(1));

    // Apply a filter on the same view -> new queryKey slot -> refetch.
    rerender({ config: withFilter });
    await waitFor(() => expect(service.listRows).toHaveBeenCalledTimes(2));
    expect(service.listRows).toHaveBeenLastCalledWith({
      databaseId: dbId,
      filters: [{ propertyId: "p1", op: "eq", value: "x" }],
      sorts: [],
    });

    // Two distinct cache slots survive for the same view.
    expect(
      qc.getQueryData(databaseRowsKey(dbId, "v1", { filters: [], sorts: [] })),
    ).toBeDefined();
    expect(
      qc.getQueryData(
        databaseRowsKey(dbId, "v1", {
          filters: [{ propertyId: "p1", op: "eq", value: "x" }],
          sorts: [],
        }),
      ),
    ).toBeDefined();
  });
});

describe("useDeleteRowsMutation", () => {
  beforeEach(() => {
    Object.values(service).forEach((fn) => fn.mockReset());
    queryClient.clear();
  });

  it("optimistically removes the selected rows from the cache", async () => {
    service.deleteRows.mockResolvedValue(undefined);
    queryClient.setQueryData(databaseRowsKey(dbId, "v1"), [
      { row: { id: "p1" }, values: [] },
      { row: { id: "p2" }, values: [] },
      { row: { id: "p3" }, values: [] },
    ]);

    const { result } = renderHook(() => useDeleteRowsMutation(dbId), {
      wrapper,
    });
    result.current.mutate({ databaseId: dbId, pageIds: ["p1", "p3"] } as never);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(
      queryClient
        .getQueryData<IDatabaseRow[]>(databaseRowsKey(dbId, "v1"))!
        .map((r) => r.row.id),
    ).toEqual(["p2"]);
  });

  it("invalidates the rows query on error", async () => {
    service.deleteRows.mockRejectedValue(new Error("boom"));
    const invalidate = vi
      .spyOn(queryClient, "invalidateQueries")
      .mockResolvedValue(undefined as never);

    const { result } = renderHook(() => useDeleteRowsMutation(dbId), {
      wrapper,
    });
    result.current.mutate({ databaseId: dbId, pageIds: ["p1"] } as never);

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ["database-rows", dbId],
    });
    invalidate.mockRestore();
  });
});

describe("view mutations invalidate the views query", () => {
  let invalidateSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    Object.values(service).forEach((fn) => fn.mockReset());
    invalidateSpy = vi
      .spyOn(queryClient, "invalidateQueries")
      .mockResolvedValue(undefined as never);
  });
  afterEach(() => invalidateSpy.mockRestore());

  it("createView posts and invalidates views on success", async () => {
    service.createView.mockResolvedValue({ id: "v2" });
    const { result } = renderHook(() => useCreateViewMutation(dbId), {
      wrapper,
    });
    result.current.mutate({ databaseId: dbId, name: "Grid" } as never);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(service.createView).toHaveBeenCalledWith({
      databaseId: dbId,
      name: "Grid",
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: databaseViewsKey(dbId),
    });
  });

  it("updateView patches the view in the cache (no invalidate) on success", async () => {
    // Seed the views cache so patchView has something to map over.
    queryClient.setQueryData(databaseViewsKey(dbId), [
      { id: "v1", name: "Grid", config: {} },
      { id: "v2", name: "Board", config: {} },
    ]);
    const updated = {
      id: "v1",
      name: "Renamed",
      config: { filters: [{ propertyId: "p1", op: "eq", value: "x" }] },
    };
    service.updateView.mockResolvedValue(updated);
    const { result } = renderHook(() => useUpdateViewMutation(dbId), {
      wrapper,
    });
    result.current.mutate({ viewId: "v1", name: "Renamed" } as never);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    // Patched in place, not invalidated — invalidating would refetch+replace the
    // views array and clobber the container's in-flight filter edit (reseed race).
    const views = queryClient.getQueryData<{ id: string; config: unknown }[]>(
      databaseViewsKey(dbId),
    )!;
    expect(views[0]).toEqual(updated);
    expect(views[1].id).toBe("v2");
    expect(invalidateSpy).not.toHaveBeenCalledWith({
      queryKey: databaseViewsKey(dbId),
    });
  });

  it("setDefaultView invalidates views on success", async () => {
    service.setDefaultView.mockResolvedValue(undefined);
    const { result } = renderHook(() => useSetDefaultViewMutation(dbId), {
      wrapper,
    });
    result.current.mutate({ viewId: "v2" } as never);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: databaseViewsKey(dbId),
    });
  });

  it("createView forwards embedId/visibility to the service and invalidates the embed scope", async () => {
    service.createView.mockResolvedValue({ id: "v9" });
    const { result } = renderHook(
      () => useCreateViewMutation(dbId, "embed-1"),
      { wrapper },
    );
    result.current.mutate({
      databaseId: dbId,
      name: "Mine",
      type: "table",
      embedId: "embed-1",
      visibility: "personal",
    } as never);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(service.createView).toHaveBeenCalledWith({
      databaseId: dbId,
      name: "Mine",
      type: "table",
      embedId: "embed-1",
      visibility: "personal",
    });
    // The embed scope (not the original) is the slot invalidated.
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: databaseViewsKey(dbId, "embed-1"),
    });
  });
});

describe("useDatabaseViewsQuery embed scope", () => {
  beforeEach(() => {
    Object.values(service).forEach((fn) => fn.mockReset());
    queryClient.clear();
  });

  it("passes the embedId to listViews and caches under the embed scope slot", async () => {
    const views = [{ id: "v9", embedId: "embed-1" }];
    service.listViews.mockResolvedValue(views);

    const { result } = renderHook(
      () => useDatabaseViewsQuery(dbId, "embed-1"),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(service.listViews).toHaveBeenCalledWith({
      databaseId: dbId,
      embedId: "embed-1",
    });
    expect(
      queryClient.getQueryData(databaseViewsKey(dbId, "embed-1")),
    ).toBe(views);
  });
});

describe("value mutations broadcast the change to collaborators (#55 Phase 2)", () => {
  const broadcastChange = vi.fn();

  function collabWrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <DatabaseCollabContext.Provider value={{ broadcastChange }}>
          {children}
        </DatabaseCollabContext.Provider>
      </QueryClientProvider>
    );
  }

  beforeEach(() => {
    broadcastChange.mockReset();
    service.setValue.mockReset();
    service.clearValue.mockReset();
  });

  it("setValue broadcasts a set signal carrying the committed value", async () => {
    const value = {
      id: "val1",
      pageId: "p1",
      propertyId: "prop1",
      value: { type: "text", value: "hi" },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    service.setValue.mockResolvedValue(value);
    const { result } = renderHook(() => useSetValueMutation(dbId), {
      wrapper: collabWrapper,
    });

    result.current.mutate({
      pageId: "p1",
      propertyId: "prop1",
      value: { type: "text", value: "hi" },
    } as never);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(broadcastChange).toHaveBeenCalledWith({ kind: "set", value });
  });

  it("clearValue broadcasts a clear signal for the cleared cell", async () => {
    service.clearValue.mockResolvedValue(undefined);
    const { result } = renderHook(() => useClearValueMutation(dbId), {
      wrapper: collabWrapper,
    });

    result.current.mutate({ pageId: "p1", propertyId: "prop1" } as never);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(broadcastChange).toHaveBeenCalledWith({
      kind: "clear",
      pageId: "p1",
      propertyId: "prop1",
    });
  });
});
