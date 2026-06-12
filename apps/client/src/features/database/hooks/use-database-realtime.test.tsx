import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { databaseRowsKey } from "@/features/database/queries/database-cache.ts";
import {
  IDatabasePropertyValue,
  IDatabaseRow,
} from "@/features/database/types/database.types.ts";
import { useDatabaseRealtime } from "./use-database-realtime";

// --- Fake Hocuspocus provider/awareness --------------------------------

class FakeAwareness {
  states = new Map<number, any>();
  private listeners = new Set<() => void>();
  getStates() {
    return this.states;
  }
  on(_event: string, cb: () => void) {
    this.listeners.add(cb);
  }
  off(_event: string, cb: () => void) {
    this.listeners.delete(cb);
  }
  // test helper: set a remote peer's awareness state and notify
  setPeer(clientId: number, state: any) {
    this.states.set(clientId, state);
    this.emit();
  }
  emit() {
    this.listeners.forEach((cb) => cb());
  }
}

class FakeProvider {
  awareness = new FakeAwareness();
  document: { clientID: number };
  setAwarenessField = vi.fn((field: string, value: any) => {
    const prev = this.awareness.states.get(this.document.clientID) ?? {};
    this.awareness.states.set(this.document.clientID, {
      ...prev,
      [field]: value,
    });
    this.awareness.emit();
  });
  constructor(clientID: number) {
    this.document = { clientID };
  }
}

const dbId = "db1";

function makeValue(
  pageId: string,
  propertyId: string,
  v: string,
  updatedAt: Date,
): IDatabasePropertyValue {
  return {
    id: `${pageId}-${propertyId}`,
    pageId,
    propertyId,
    value: { type: "text", value: v } as any,
    createdAt: new Date(0),
    updatedAt,
  };
}

function setup(provider: FakeProvider | null) {
  const qc = new QueryClient();
  qc.setQueryData<IDatabaseRow[]>(databaseRowsKey(dbId, "v1"), [
    { row: { id: "p1" } as any, values: [] },
  ]);
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  const view = renderHook(
    () => useDatabaseRealtime(provider as any, dbId),
    { wrapper },
  );
  return { qc, ...view };
}

function rowValues(qc: QueryClient) {
  return qc.getQueryData<IDatabaseRow[]>(databaseRowsKey(dbId, "v1"))![0].values;
}

describe("useDatabaseRealtime", () => {
  beforeEach(() => vi.clearAllMocks());

  it("broadcasts a change into awareness with origin and incrementing rev", () => {
    const provider = new FakeProvider(11);
    const { result } = setup(provider);

    result.current.broadcastChange({
      kind: "clear",
      pageId: "p1",
      propertyId: "prop1",
    });
    result.current.broadcastChange({
      kind: "clear",
      pageId: "p1",
      propertyId: "prop2",
    });

    const calls = provider.setAwarenessField.mock.calls;
    expect(calls[0][0]).toBe("dbChange");
    expect(calls[0][1]).toMatchObject({ origin: 11, rev: 1 });
    expect(calls[1][1]).toMatchObject({ origin: 11, rev: 2 });
  });

  it("applies a remote set signal to the row cache", () => {
    const provider = new FakeProvider(11);
    const { qc } = setup(provider);
    const value = makeValue("p1", "prop1", "hello", new Date(1000));

    provider.awareness.setPeer(22, {
      dbChange: { origin: 22, rev: 1, change: { kind: "set", value } },
    });

    expect(rowValues(qc)).toEqual([value]);
  });

  it("applies a remote clear signal to the row cache", () => {
    const provider = new FakeProvider(11);
    const { qc } = setup(provider);
    const value = makeValue("p1", "prop1", "hello", new Date(1000));
    qc.setQueryData<IDatabaseRow[]>(databaseRowsKey(dbId, "v1"), [
      { row: { id: "p1" } as any, values: [value] },
    ]);

    provider.awareness.setPeer(22, {
      dbChange: {
        origin: 22,
        rev: 1,
        change: { kind: "clear", pageId: "p1", propertyId: "prop1" },
      },
    });

    expect(rowValues(qc)).toEqual([]);
  });

  it("ignores its own echo (same clientID)", () => {
    const provider = new FakeProvider(11);
    const { qc } = setup(provider);
    const value = makeValue("p1", "prop1", "self", new Date(1000));

    // A signal published under the local clientID must not be re-applied.
    provider.awareness.setPeer(11, {
      dbChange: { origin: 11, rev: 1, change: { kind: "set", value } },
    });

    expect(rowValues(qc)).toEqual([]);
  });

  it("applies each peer rev only once (no double-apply on re-emit)", () => {
    const provider = new FakeProvider(11);
    const { qc } = setup(provider);
    const value = makeValue("p1", "prop1", "v1", new Date(1000));

    provider.awareness.setPeer(22, {
      dbChange: { origin: 22, rev: 1, change: { kind: "set", value } },
    });
    // Same rev re-emitted (e.g. another presence field changed) — locally
    // clear the cell first to prove the stale rev is NOT re-applied.
    qc.setQueryData<IDatabaseRow[]>(databaseRowsKey(dbId, "v1"), [
      { row: { id: "p1" } as any, values: [] },
    ]);
    provider.awareness.emit();

    expect(rowValues(qc)).toEqual([]);
  });

  it("converges last-write-wins: a stale (older) remote value is ignored", () => {
    const provider = new FakeProvider(11);
    const { qc } = setup(provider);
    const current = makeValue("p1", "prop1", "current", new Date(2000));
    qc.setQueryData<IDatabaseRow[]>(databaseRowsKey(dbId, "v1"), [
      { row: { id: "p1" } as any, values: [current] },
    ]);
    const stale = makeValue("p1", "prop1", "stale", new Date(1000));

    provider.awareness.setPeer(22, {
      dbChange: { origin: 22, rev: 1, change: { kind: "set", value: stale } },
    });

    expect(rowValues(qc)[0].value).toEqual(current.value);
  });

  it("broadcastChange is a safe no-op when no provider is connected", () => {
    const { result } = setup(null);
    expect(() =>
      result.current.broadcastChange({
        kind: "clear",
        pageId: "p1",
        propertyId: "prop1",
      }),
    ).not.toThrow();
  });
});
