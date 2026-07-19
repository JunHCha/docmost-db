import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";

let membersData: any[] = [];

vi.mock("@/features/workspace/queries/workspace-query.ts", () => ({
  useWorkspaceMembersQuery: () => ({ data: { items: membersData } }),
}));

import { CreatedByCell } from "./created-by-cell";
import { IDatabaseProperty } from "@/features/database/types/database.types.ts";

const property: IDatabaseProperty = {
  id: "p-cb",
  databaseId: "db1",
  name: "Created by",
  type: "created_by",
  config: {},
  position: "a0",
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
};

function renderCell(value: any) {
  return render(
    <MantineProvider>
      <CreatedByCell
        property={property}
        value={value}
        pageId="page1"
        databaseId="db1"
      />
    </MantineProvider>,
  );
}

describe("CreatedByCell", () => {
  beforeEach(() => {
    membersData = [
      { id: "u1", name: "Alice", email: "a@x.io", avatarUrl: "" },
    ];
  });

  it("resolves the creator id to the member name", () => {
    renderCell({ type: "created_by", value: "u1" });
    expect(screen.getByText("Alice")).toBeTruthy();
  });

  it("falls back to the raw id when the member is unknown", () => {
    renderCell({ type: "created_by", value: "u-missing" });
    expect(screen.getByText("u-missing")).toBeTruthy();
  });

  it("renders nothing for an empty value", () => {
    const { container } = renderCell(undefined);
    expect((container.querySelector("p") as HTMLElement).textContent).toBe("");
  });
});
