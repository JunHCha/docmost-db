import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";

const setMutate = vi.fn();
const clearMutate = vi.fn();

vi.mock("@/features/database/queries/database-query.ts", () => ({
  useSetValueMutation: () => ({ mutate: setMutate }),
  useClearValueMutation: () => ({ mutate: clearMutate }),
}));

import { CheckboxCell } from "./checkbox-cell";
import { IDatabaseProperty } from "@/features/database/types/database.types.ts";

const property: IDatabaseProperty = {
  id: "prop1",
  databaseId: "db1",
  name: "Done",
  type: "checkbox",
  config: {},
  position: "a0",
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
};

function renderCell(value: any) {
  return render(
    <MantineProvider>
      <CheckboxCell
        property={property}
        value={value}
        pageId="page1"
        databaseId="db1"
      />
    </MantineProvider>,
  );
}

describe("CheckboxCell", () => {
  beforeEach(() => {
    setMutate.mockReset();
    clearMutate.mockReset();
  });

  it("sets checkbox true when toggled on", () => {
    renderCell(undefined);
    fireEvent.click(screen.getByLabelText("Done"));
    expect(setMutate).toHaveBeenCalledWith({
      pageId: "page1",
      propertyId: "prop1",
      value: { type: "checkbox", value: true },
    });
  });

  it("clears the value when toggled off", () => {
    renderCell({ type: "checkbox", value: true });
    fireEvent.click(screen.getByLabelText("Done"));
    expect(clearMutate).toHaveBeenCalledWith({
      pageId: "page1",
      propertyId: "prop1",
    });
  });

  it("controlled: emits onChange(true) on toggle on, no mutation", () => {
    const onChange = vi.fn();
    render(
      <MantineProvider>
        <CheckboxCell
          property={property}
          value={undefined}
          pageId=""
          databaseId="db1"
          onChange={onChange}
        />
      </MantineProvider>,
    );
    fireEvent.click(screen.getByLabelText("Done"));
    expect(onChange).toHaveBeenCalledWith({ type: "checkbox", value: true });
    expect(setMutate).not.toHaveBeenCalled();
  });

  it("controlled: emits onChange(undefined) on toggle off, no mutation", () => {
    const onChange = vi.fn();
    render(
      <MantineProvider>
        <CheckboxCell
          property={property}
          value={{ type: "checkbox", value: true }}
          pageId=""
          databaseId="db1"
          onChange={onChange}
        />
      </MantineProvider>,
    );
    fireEvent.click(screen.getByLabelText("Done"));
    expect(onChange).toHaveBeenCalledWith(undefined);
    expect(clearMutate).not.toHaveBeenCalled();
  });
});
