import { describe, it, expect, vi, beforeEach } from "vitest";

const { post } = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock("@/lib/api-client", () => ({
  default: { post },
}));

import {
  createDatabase,
  getDatabaseInfo,
  listDatabases,
  listProperties,
  createProperty,
  updateProperty,
  reorderProperty,
  deleteProperty,
  listRows,
  createRow,
  setValue,
  clearValue,
  listViews,
  createView,
  updateView,
  deleteView,
  setDefaultView,
  listTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
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

  it("listDatabases posts to /databases/list and returns data", async () => {
    const data = [{ id: "db1", pageId: "p1", title: "Tasks", icon: null }];
    post.mockResolvedValue({ data });

    const result = await listDatabases({ spaceId: "s1" });

    expect(post).toHaveBeenCalledWith("/databases/list", { spaceId: "s1" });
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

  it("createRow forwards templateId when given", async () => {
    post.mockResolvedValue({ data: { id: "p3" } });

    await createRow({ databaseId: "db1", templateId: "t1" });

    expect(post).toHaveBeenCalledWith("/databases/rows/create", {
      databaseId: "db1",
      templateId: "t1",
    });
  });

  it("listTemplates posts to /databases/templates/list and returns data", async () => {
    const data = [{ id: "t1" }];
    post.mockResolvedValue({ data });

    const result = await listTemplates({ databaseId: "db1" });

    expect(post).toHaveBeenCalledWith("/databases/templates/list", {
      databaseId: "db1",
    });
    expect(result).toBe(data);
  });

  it("createTemplate posts to /databases/templates/create and returns data", async () => {
    const data = { id: "t1" };
    post.mockResolvedValue({ data });

    const result = await createTemplate({ databaseId: "db1", name: "Bug" });

    expect(post).toHaveBeenCalledWith("/databases/templates/create", {
      databaseId: "db1",
      name: "Bug",
    });
    expect(result).toBe(data);
  });

  it("updateTemplate posts to /databases/templates/update and returns data", async () => {
    const data = { id: "t1" };
    post.mockResolvedValue({ data });

    const result = await updateTemplate({ templateId: "t1", name: "Task" });

    expect(post).toHaveBeenCalledWith("/databases/templates/update", {
      templateId: "t1",
      name: "Task",
    });
    expect(result).toBe(data);
  });

  it("deleteTemplate posts to /databases/templates/delete", async () => {
    post.mockResolvedValue({ data: undefined });

    await deleteTemplate({ templateId: "t1" });

    expect(post).toHaveBeenCalledWith("/databases/templates/delete", {
      templateId: "t1",
    });
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

  it("listViews posts to /databases/views/list and returns data", async () => {
    const data = [{ id: "v1" }];
    post.mockResolvedValue({ data });

    const result = await listViews({ databaseId: "db1" });

    expect(post).toHaveBeenCalledWith("/databases/views/list", {
      databaseId: "db1",
    });
    expect(result).toBe(data);
  });

  it("createView posts to /databases/views/create and returns data", async () => {
    const data = { id: "v2" };
    post.mockResolvedValue({ data });

    const result = await createView({ databaseId: "db1", name: "Grid" });

    expect(post).toHaveBeenCalledWith("/databases/views/create", {
      databaseId: "db1",
      name: "Grid",
    });
    expect(result).toBe(data);
  });

  it("forwards embedId and pageId on list/create for orphan reconcile", async () => {
    post.mockResolvedValue({ data: [] });
    await listViews({ databaseId: "db1", embedId: "e1", pageId: "p1" });
    expect(post).toHaveBeenCalledWith("/databases/views/list", {
      databaseId: "db1",
      embedId: "e1",
      pageId: "p1",
    });

    post.mockResolvedValue({ data: {} });
    await createView({
      databaseId: "db1",
      name: "Grid",
      embedId: "e1",
      pageId: "p1",
    });
    expect(post).toHaveBeenCalledWith("/databases/views/create", {
      databaseId: "db1",
      name: "Grid",
      embedId: "e1",
      pageId: "p1",
    });
  });

  it("updateView posts to /databases/views/update and returns data", async () => {
    const data = { id: "v1" };
    post.mockResolvedValue({ data });

    const result = await updateView({ viewId: "v1", name: "Renamed" });

    expect(post).toHaveBeenCalledWith("/databases/views/update", {
      viewId: "v1",
      name: "Renamed",
    });
    expect(result).toBe(data);
  });

  it("setDefaultView posts to /databases/views/set-default", async () => {
    post.mockResolvedValue({ data: undefined });

    await setDefaultView({ viewId: "v1" });

    expect(post).toHaveBeenCalledWith("/databases/views/set-default", {
      viewId: "v1",
    });
  });

  it("deleteView posts to /databases/views/delete", async () => {
    post.mockResolvedValue({ data: undefined });

    await deleteView({ viewId: "v1" });

    expect(post).toHaveBeenCalledWith("/databases/views/delete", {
      viewId: "v1",
    });
  });
});
