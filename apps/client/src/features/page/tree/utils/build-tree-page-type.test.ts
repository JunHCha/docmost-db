import { describe, it, expect } from "vitest";
import { buildTree } from "./utils";
import type { IPage } from "@/features/page/types/page.types";

const page = (id: string, pageType?: "doc" | "database"): IPage =>
  ({
    id,
    slugId: id,
    title: id,
    position: "a",
    spaceId: "s1",
    parentPageId: null,
    pageType,
  } as unknown as IPage);

describe("buildTree pageType mapping", () => {
  it("preserves pageType on tree nodes", () => {
    const tree = buildTree([page("db1", "database"), page("doc1", "doc")]);
    const byId = Object.fromEntries(tree.map((n) => [n.id, n]));
    expect(byId.db1.pageType).toBe("database");
    expect(byId.doc1.pageType).toBe("doc");
  });
});
