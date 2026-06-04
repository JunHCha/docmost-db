import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";

const deleteMutate = vi.fn();
vi.mock("@/features/database/queries/database-query.ts", () => ({
  useDeleteRowsMutation: () => ({ mutate: deleteMutate }),
}));

import { SelectionActionBar } from "./selection-action-bar";

function renderBar(selectedIds: string[]) {
  const onClear = vi.fn();
  render(
    <MantineProvider>
      <SelectionActionBar
        databaseId="db1"
        selectedIds={new Set(selectedIds)}
        onClear={onClear}
      />
    </MantineProvider>,
  );
  return { onClear };
}

describe("SelectionActionBar", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows the number of selected rows", () => {
    renderBar(["a", "b", "c"]);
    expect(screen.getByText(/3\s+selected/)).toBeTruthy();
  });

  it("deletes the selected pageIds through useDeleteRowsMutation", () => {
    renderBar(["a", "b"]);
    fireEvent.click(screen.getByLabelText("Delete selected rows"));
    expect(deleteMutate).toHaveBeenCalledWith(
      { databaseId: "db1", pageIds: ["a", "b"] },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it("clears the selection after a successful delete", () => {
    const { onClear } = renderBar(["a"]);
    fireEvent.click(screen.getByLabelText("Delete selected rows"));
    // mutate is called with options whose onSuccess clears the selection
    const opts = deleteMutate.mock.calls[0][1];
    opts.onSuccess();
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it("clears the selection when the clear button is clicked", () => {
    const { onClear } = renderBar(["a", "b"]);
    fireEvent.click(screen.getByLabelText("Clear selection"));
    expect(onClear).toHaveBeenCalledTimes(1);
    expect(deleteMutate).not.toHaveBeenCalled();
  });
});
