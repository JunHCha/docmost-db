import { describe, it, expect, vi, beforeEach } from "vitest";
import { ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import {
  databasePropertiesKey,
  databaseRowsKey,
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

const service = {
  setValue: vi.fn(),
  clearValue: vi.fn(),
  createRow: vi.fn(),
  createProperty: vi.fn(),
  updateProperty: vi.fn(),
  deleteProperty: vi.fn(),
  reorderProperty: vi.fn(),
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
  listRows: vi.fn(),
}));

import {
  useClearValueMutation,
  useCreatePropertyMutation,
  useCreateRowMutation,
  useDeletePropertyMutation,
  useReorderPropertyMutation,
  useSetValueMutation,
  useUpdatePropertyMutation,
} from "./database-query.ts";

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
      queryKey: databaseRowsKey(dbId),
    });
  });

  it("clearValue invalidates the rows query on error", async () => {
    const { result } = renderHook(() => useClearValueMutation(dbId), {
      wrapper,
    });
    result.current.mutate({} as never);
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: databaseRowsKey(dbId),
    });
  });

  it("createRow invalidates the rows query on error", async () => {
    const { result } = renderHook(() => useCreateRowMutation(dbId), {
      wrapper,
    });
    result.current.mutate({} as never);
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: databaseRowsKey(dbId),
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
