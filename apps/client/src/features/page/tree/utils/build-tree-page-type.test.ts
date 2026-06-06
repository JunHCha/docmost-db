import { describe, it, expect } from "vitest";
import { buildTree } from "./utils";
import type { IPage } from "@/features/page/types/page.types";

const page = (
  id: string,
  pageType?: "doc" | "database",
  hasChildren?: boolean,
): IPage =>
  ({
    id,
    slugId: id,
    title: id,
    position: "a",
    spaceId: "s1",
    parentPageId: null,
    pageType,
    hasChildren,
  } as unknown as IPage);

describe("buildTree pageType mapping", () => {
  it("preserves pageType on tree nodes", () => {
    const tree = buildTree([page("db1", "database"), page("doc1", "doc")]);
    const byId = Object.fromEntries(tree.map((n) => [n.id, n]));
    expect(byId.db1.pageType).toBe("database");
    expect(byId.doc1.pageType).toBe("doc");
  });

  it("forces hasChildren to false for database pages", () => {
    const tree = buildTree([page("db1", "database", true)]);
    const byId = Object.fromEntries(tree.map((n) => [n.id, n]));
    expect(byId.db1.hasChildren).toBe(false);
  });

  it("keeps hasChildren=true for doc pages with children", () => {
    const tree = buildTree([page("doc1", "doc", true)]);
    const byId = Object.fromEntries(tree.map((n) => [n.id, n]));
    expect(byId.doc1.hasChildren).toBe(true);
  });
});
