import { describe, it, expect, beforeEach, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";

// invalidateOnCreatePage patches the module-level queryClient from main.tsx;
// swap it for an isolated one so we can assert the cache it writes.
const queryClient = new QueryClient();
vi.mock("@/main.tsx", () => ({
  get queryClient() {
    return queryClient;
  },
}));

import { invalidateOnCreatePage } from "./page-query.ts";

const rootKey = (spaceId: string) => ["root-sidebar-pages", spaceId];

function seedRoot(spaceId: string) {
  queryClient.setQueryData(rootKey(spaceId), {
    pages: [{ items: [] }],
    pageParams: [],
  });
}

describe("invalidateOnCreatePage", () => {
  beforeEach(() => {
    queryClient.clear();
  });

  it("propagates pageType so the sidebar keeps the database icon", () => {
    seedRoot("s1");

    invalidateOnCreatePage({
      id: "db1",
      spaceId: "s1",
      parentPageId: null,
      pageType: "database",
    } as any);

    const data: any = queryClient.getQueryData(rootKey("s1"));
    const item = data.pages[0].items.find((p: any) => p.id === "db1");
    expect(item).toBeTruthy();
    expect(item.pageType).toBe("database");
  });
});
