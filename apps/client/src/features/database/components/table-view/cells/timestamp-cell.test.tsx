import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import dayjs from "dayjs";
import { TimestampCell } from "./timestamp-cell";
import { IDatabaseProperty } from "@/features/database/types/database.types.ts";

const property: IDatabaseProperty = {
  id: "p-ct",
  databaseId: "db1",
  name: "Created",
  type: "created_time",
  config: {},
  position: "a0",
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
};

function renderCell(value: any) {
  return render(
    <MantineProvider>
      <TimestampCell
        property={property}
        value={value}
        pageId="page1"
        databaseId="db1"
      />
    </MantineProvider>,
  );
}

describe("TimestampCell", () => {
  it("formats an ISO timestamp as YYYY-MM-DD HH:mm", () => {
    const iso = "2026-01-02T13:45:00.000Z";
    renderCell({ type: "created_time", value: iso });
    expect(
      screen.getByText(dayjs(iso).format("YYYY-MM-DD HH:mm")),
    ).toBeTruthy();
  });

  it("renders nothing for a missing value", () => {
    const { container } = renderCell(undefined);
    expect((container.querySelector("p") as HTMLElement).textContent).toBe("");
  });
});
