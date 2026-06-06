import { describe, it, expect } from "vitest";
import { resolveEmbedState } from "./embed-state";
import { IDatabase } from "@/features/database/types/database.types.ts";

const database: IDatabase = {
  id: "db1",
  pageId: "p1",
  spaceId: "space1",
  workspaceId: "ws1",
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
};

describe("resolveEmbedState", () => {
  it("reports broken attrs when databaseId is missing", () => {
    const state = resolveEmbedState({
      databaseId: null,
      isLoading: false,
      isError: false,
      status: undefined,
      database: undefined,
    });
    expect(state.kind).toBe("not_found");
  });

  it("is loading while the info query is in flight", () => {
    const state = resolveEmbedState({
      databaseId: "db1",
      isLoading: true,
      isError: false,
      status: undefined,
      database: undefined,
    });
    expect(state.kind).toBe("loading");
  });

  it("maps a 403 error to no_access", () => {
    const state = resolveEmbedState({
      databaseId: "db1",
      isLoading: false,
      isError: true,
      status: 403,
      database: undefined,
    });
    expect(state.kind).toBe("no_access");
  });

  it("maps a 404 error to not_found", () => {
    const state = resolveEmbedState({
      databaseId: "db1",
      isLoading: false,
      isError: true,
      status: 404,
      database: undefined,
    });
    expect(state.kind).toBe("not_found");
  });

  it("treats a null database (200 with no database) as not_found", () => {
    const state = resolveEmbedState({
      databaseId: "db1",
      isLoading: false,
      isError: false,
      status: undefined,
      database: null,
    });
    expect(state.kind).toBe("not_found");
  });

  it("falls back to a generic error for other failures", () => {
    const state = resolveEmbedState({
      databaseId: "db1",
      isLoading: false,
      isError: true,
      status: 500,
      database: undefined,
    });
    expect(state.kind).toBe("error");
  });

  it("is ready with the resolved database when info loads", () => {
    const state = resolveEmbedState({
      databaseId: "db1",
      isLoading: false,
      isError: false,
      status: undefined,
      database,
    });
    expect(state.kind).toBe("ready");
    if (state.kind === "ready") {
      expect(state.database.spaceId).toBe("space1");
    }
  });
});
