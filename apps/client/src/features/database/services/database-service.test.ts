import { describe, it, expect, vi, beforeEach } from "vitest";

const { post } = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock("@/lib/api-client", () => ({
  default: { post },
}));

import { createDatabase } from "./database-service";

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
});
