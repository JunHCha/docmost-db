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
  getDatabaseInfo: vi.fn(),
  listProperties: vi.fn(),
  listRows: (...a: unknown[]) => service.listRows(...a),
  deleteRows: (...a: unknown[]) => service.deleteRows(...a),
  listDatabases: (...a: unknown[]) => service.listDatabases(...a),
  listViews: vi.fn(),
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
  useDatabaseRowsQuery,
  useDeletePropertyMutation,
  useDeleteRowsMutation,
  useListDatabasesQuery,
  useReorderPropertyMutation,
  useSetDefaultViewMutation,
  useSetValueMutation,
  useUpdatePropertyMutation,
  useUpdateViewMutation,
} from "./database-query.ts";
import { databaseRowsKey, databasesKey } from "./database-cache.ts";
import { IDatabaseRow } from "@/features/database/types/database.types.ts";

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

  it("updateView invalidates views on success", async () => {
    service.updateView.mockResolvedValue({ id: "v1" });
    const { result } = renderHook(() => useUpdateViewMutation(dbId), {
      wrapper,
    });
    result.current.mutate({ viewId: "v1", name: "Renamed" } as never);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({
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
});
