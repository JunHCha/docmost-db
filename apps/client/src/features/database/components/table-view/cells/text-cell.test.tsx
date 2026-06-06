import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";

const setMutate = vi.fn();
const clearMutate = vi.fn();

vi.mock("@/features/database/queries/database-query.ts", () => ({
  useSetValueMutation: () => ({ mutate: setMutate }),
  useClearValueMutation: () => ({ mutate: clearMutate }),
}));

import { TextCell } from "./text-cell";
import { IDatabaseProperty } from "@/features/database/types/database.types.ts";

const property: IDatabaseProperty = {
  id: "prop1",
  databaseId: "db1",
  name: "Name",
  type: "text",
  config: {},
  position: "a0",
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
};

function renderCell(value: any) {
  return render(
    <MantineProvider>
      <TextCell
        property={property}
        value={value}
        pageId="page1"
        databaseId="db1"
      />
    </MantineProvider>,
  );
}

describe("TextCell", () => {
  beforeEach(() => {
    setMutate.mockReset();
    clearMutate.mockReset();
  });

  it("commits a new value with setValue on blur", () => {
    renderCell(undefined);
    fireEvent.click(screen.getByText("", { selector: "p" }));
    const input = screen.getByLabelText("Name");
    fireEvent.change(input, { target: { value: "hello" } });
    fireEvent.blur(input);
    expect(setMutate).toHaveBeenCalledWith({
      pageId: "page1",
      propertyId: "prop1",
      value: { type: "text", value: "hello" },
    });
    expect(clearMutate).not.toHaveBeenCalled();
  });

  it("clears the value when emptied", () => {
    renderCell({ type: "text", value: "hello" });
    fireEvent.click(screen.getByText("hello"));
    const input = screen.getByLabelText("Name");
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.blur(input);
    expect(clearMutate).toHaveBeenCalledWith({
      pageId: "page1",
      propertyId: "prop1",
    });
    expect(setMutate).not.toHaveBeenCalled();
  });
});
