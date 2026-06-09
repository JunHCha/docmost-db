import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { Provider, createStore } from "jotai";
import { currentUserAtom } from "@/features/user/atoms/current-user-atom";

// --- Mocks --------------------------------------------------------------
// vi.mock factories are hoisted above all module-level code, so the fake
// classes they reference must live inside vi.hoisted (which runs first)
// rather than as plain top-level declarations.

const mocks = vi.hoisted(() => {
  const state: { lastProvider: any } = { lastProvider: null };

  class FakeAwareness {
    clientID = 1;
    states = new Map<number, any>();
    listeners = new Set<() => void>();

    getStates() {
      return this.states;
    }
    setLocalStateField(field: string, value: any) {
      const prev = this.states.get(this.clientID) ?? {};
      this.states.set(this.clientID, { ...prev, [field]: value });
      this.emit();
    }
    on(_event: string, cb: () => void) {
      this.listeners.add(cb);
    }
    off(_event: string, cb: () => void) {
      this.listeners.delete(cb);
    }
    // test helper: simulate a remote peer joining
    __setRemote(clientId: number, peerState: any) {
      this.states.set(clientId, peerState);
      this.emit();
    }
    emit() {
      this.listeners.forEach((cb) => cb());
    }
  }

  class FakeProvider {
    name: string;
    awareness = new FakeAwareness();
    setAwarenessField = vi.fn((field: string, value: any) => {
      this.awareness.setLocalStateField(field, value);
    });
    // HocuspocusProvider only subscribes to the socket's open event (and thus
    // sends auth/sync/awareness frames) once attach() is called when a shared
    // websocketProvider is supplied; the hook must call it explicitly.
    attach = vi.fn();
    destroy = vi.fn();
    constructor(config: any) {
      this.name = config.name;
      state.lastProvider = this;
    }
  }

  class FakeSocket {
    destroy = vi.fn();
    constructor(public config: any) {}
  }

  return { state, FakeProvider, FakeSocket };
});

vi.mock("@hocuspocus/provider", () => ({
  HocuspocusProvider: mocks.FakeProvider,
  HocuspocusProviderWebsocket: mocks.FakeSocket,
}));

vi.mock("@/lib/config.ts", () => ({
  getCollaborationUrl: () => "ws://localhost/collab",
}));

vi.mock("@/features/auth/queries/auth-query.tsx", () => ({
  useCollabToken: () => ({ data: { token: "test-token" } }),
}));

import { useDatabaseCollab } from "./use-database-collab";

const me = {
  id: "user-1",
  name: "Me",
  avatarUrl: "me.png",
};

function wrapper(store: ReturnType<typeof createStore>) {
  return ({ children }: { children: React.ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );
}

function buildStore() {
  const store = createStore();
  store.set(currentUserAtom, { user: me, workspace: {} } as any);
  return store;
}

describe("useDatabaseCollab", () => {
  beforeEach(() => {
    mocks.state.lastProvider = null;
    vi.clearAllMocks();
  });

  it("connects with the db.<pageId> document name", () => {
    const store = buildStore();
    renderHook(() => useDatabaseCollab("page-42"), {
      wrapper: wrapper(store),
    });
    expect(mocks.state.lastProvider?.name).toBe("db.page-42");
  });

  it("attaches the provider so it actually connects and syncs", () => {
    const store = buildStore();
    renderHook(() => useDatabaseCollab("page-42"), {
      wrapper: wrapper(store),
    });
    // Without attach() a websocketProvider-backed HocuspocusProvider never
    // subscribes to the socket open event and stays silent (regression guard).
    expect(mocks.state.lastProvider?.attach).toHaveBeenCalled();
  });

  it("publishes the current user into awareness", () => {
    const store = buildStore();
    renderHook(() => useDatabaseCollab("page-42"), {
      wrapper: wrapper(store),
    });
    expect(mocks.state.lastProvider?.setAwarenessField).toHaveBeenCalledWith("user", {
      id: "user-1",
      name: "Me",
      avatarUrl: "me.png",
    });
  });

  it("starts with no other online users", () => {
    const store = buildStore();
    const { result } = renderHook(() => useDatabaseCollab("page-42"), {
      wrapper: wrapper(store),
    });
    expect(result.current.onlineUsers).toEqual([]);
  });

  it("reflects a remote peer joining and excludes self", () => {
    const store = buildStore();
    const { result } = renderHook(() => useDatabaseCollab("page-42"), {
      wrapper: wrapper(store),
    });
    act(() => {
      mocks.state.lastProvider!.awareness.__setRemote(2, {
        user: { id: "user-2", name: "Other", avatarUrl: "o.png" },
      });
    });
    expect(result.current.onlineUsers).toEqual([
      { id: "user-2", name: "Other", avatarUrl: "o.png" },
    ]);
  });

  it("ignores awareness states that have no user payload", () => {
    const store = buildStore();
    const { result } = renderHook(() => useDatabaseCollab("page-42"), {
      wrapper: wrapper(store),
    });
    act(() => {
      mocks.state.lastProvider!.awareness.__setRemote(3, {});
    });
    expect(result.current.onlineUsers).toEqual([]);
  });

  it("tears down the provider on unmount", () => {
    const store = buildStore();
    const { unmount } = renderHook(() => useDatabaseCollab("page-42"), {
      wrapper: wrapper(store),
    });
    const provider = mocks.state.lastProvider!;
    unmount();
    expect(provider.destroy).toHaveBeenCalled();
  });
});
