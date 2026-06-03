import { describe, it, expect, vi, beforeEach } from "vitest";

const { post } = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock("@/lib/api-client", () => ({
  default: { post },
}));

import {
  createDatabase,
  getDatabaseInfo,
  listProperties,
  createProperty,
  updateProperty,
  reorderProperty,
  deleteProperty,
  listRows,
  createRow,
  setValue,
  clearValue,
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

  it("getDatabaseInfo posts to /databases/info and returns data", async () => {
    const data = { database: { id: "db1" }, page: { id: "p1" } };
    post.mockResolvedValue({ data });

    const result = await getDatabaseInfo({ pageId: "p1" });

    expect(post).toHaveBeenCalledWith("/databases/info", { pageId: "p1" });
    expect(result).toBe(data);
  });

  it("listProperties posts to /databases/properties/list and returns data", async () => {
    const data = [{ id: "prop1" }];
    post.mockResolvedValue({ data });

    const result = await listProperties({ databaseId: "db1" });

    expect(post).toHaveBeenCalledWith("/databases/properties/list", {
      databaseId: "db1",
    });
    expect(result).toBe(data);
  });

  it("createProperty posts to /databases/properties/create and returns data", async () => {
    const data = { id: "prop1" };
    post.mockResolvedValue({ data });

    const result = await createProperty({
      databaseId: "db1",
      name: "Status",
      type: "select",
    });

    expect(post).toHaveBeenCalledWith("/databases/properties/create", {
      databaseId: "db1",
      name: "Status",
      type: "select",
    });
    expect(result).toBe(data);
  });

  it("updateProperty posts to /databases/properties/update and returns data", async () => {
    const data = { id: "prop1" };
    post.mockResolvedValue({ data });

    const result = await updateProperty({ propertyId: "prop1", name: "Done" });

    expect(post).toHaveBeenCalledWith("/databases/properties/update", {
      propertyId: "prop1",
      name: "Done",
    });
    expect(result).toBe(data);
  });

  it("reorderProperty posts to /databases/properties/reorder and returns data", async () => {
    post.mockResolvedValue({ data: undefined });

    await reorderProperty({ propertyId: "prop2", afterPropertyId: "prop1" });

    expect(post).toHaveBeenCalledWith("/databases/properties/reorder", {
      propertyId: "prop2",
      afterPropertyId: "prop1",
    });
  });

  it("deleteProperty posts to /databases/properties/delete and returns data", async () => {
    post.mockResolvedValue({ data: undefined });

    await deleteProperty({ propertyId: "prop1" });

    expect(post).toHaveBeenCalledWith("/databases/properties/delete", {
      propertyId: "prop1",
    });
  });

  it("listRows posts to /databases/rows/list and returns data", async () => {
    const data = [{ row: { id: "p1" }, values: [] }];
    post.mockResolvedValue({ data });

    const result = await listRows({ databaseId: "db1" });

    expect(post).toHaveBeenCalledWith("/databases/rows/list", {
      databaseId: "db1",
    });
    expect(result).toBe(data);
  });

  it("createRow posts to /databases/rows/create and returns data", async () => {
    const data = { id: "p2" };
    post.mockResolvedValue({ data });

    const result = await createRow({ databaseId: "db1", title: "Row" });

    expect(post).toHaveBeenCalledWith("/databases/rows/create", {
      databaseId: "db1",
      title: "Row",
    });
    expect(result).toBe(data);
  });

  it("setValue posts to /databases/values/set and returns data", async () => {
    const data = { id: "v1" };
    const value = { type: "text" as const, value: "hi" };
    post.mockResolvedValue({ data });

    const result = await setValue({
      pageId: "p1",
      propertyId: "prop1",
      value,
    });

    expect(post).toHaveBeenCalledWith("/databases/values/set", {
      pageId: "p1",
      propertyId: "prop1",
      value,
    });
    expect(result).toBe(data);
  });

  it("clearValue posts to /databases/values/clear and returns data", async () => {
    post.mockResolvedValue({ data: undefined });

    await clearValue({ pageId: "p1", propertyId: "prop1" });

    expect(post).toHaveBeenCalledWith("/databases/values/clear", {
      pageId: "p1",
      propertyId: "prop1",
    });
  });
});
