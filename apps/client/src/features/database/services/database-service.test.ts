import { describe, it, expect, vi, beforeEach } from "vitest";

const { post } = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock("@/lib/api-client", () => ({
  default: { post },
}));

import {
  createDatabase,
  getDatabaseInfo,
  getDatabaseList,
} from "./database-service";

describe("database-service", () => {
  beforeEach(() => {
    post.mockReset();
  });

  it("createDatabase posts to /databases/create and returns data", async () => {
    const data = { database: { id: "db1" }, page: { id: "p1" } };
    post.mockResolvedValue({ data });

    const result = await createDatabase({ spaceId: "s1", title: "Tasks" });

    expect(post).toHaveBeenCalledWith("/databases/create", {
      spaceId: "s1",
      title: "Tasks",
    });
    expect(result).toBe(data);
  });

  it("getDatabaseInfo posts to /databases/info with databaseId", async () => {
    const data = { database: { id: "db1" }, page: { id: "p1" } };
    post.mockResolvedValue({ data });

    const result = await getDatabaseInfo({ databaseId: "db1" });

    expect(post).toHaveBeenCalledWith("/databases/info", { databaseId: "db1" });
    expect(result).toBe(data);
  });

  it("getDatabaseList posts to /databases/list with spaceId", async () => {
    const data = [{ id: "db1" }];
    post.mockResolvedValue({ data });

    const result = await getDatabaseList({ spaceId: "s1" });

    expect(post).toHaveBeenCalledWith("/databases/list", { spaceId: "s1" });
    expect(result).toBe(data);
  });
});
