import { describe, it, expect, vi, afterEach } from "vitest";
import { useRef } from "react";
import { render, act, cleanup, fireEvent } from "@testing-library/react";
import { useEditingCellTracker } from "./use-editing-cell-tracker";

afterEach(cleanup);

function Harness({ setEditingCell }: { setEditingCell: (c: any) => void }) {
  const rootRef = useRef<HTMLDivElement>(null);
  useEditingCellTracker(rootRef, setEditingCell);
  return (
    <div ref={rootRef}>
      <div data-db-cell="" data-row-id="r1" data-property-id="p1">
        <input aria-label="a" />
      </div>
      <div data-db-cell="" data-row-id="r2" data-property-id="p2">
        <input aria-label="b" />
      </div>
    </div>
  );
}

async function flush() {
  // useEditingCellTracker recomputes on the next tick after focusout.
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

describe("useEditingCellTracker", () => {
  it("publishes the cell when an input inside it gains focus", () => {
    const setEditingCell = vi.fn();
    const { getByLabelText } = render(
      <Harness setEditingCell={setEditingCell} />,
    );
    act(() => getByLabelText("a").focus());
    expect(setEditingCell).toHaveBeenLastCalledWith({
      rowId: "r1",
      propertyId: "p1",
    });
  });

  it("switches the published cell when focus moves to another cell", () => {
    const setEditingCell = vi.fn();
    const { getByLabelText } = render(
      <Harness setEditingCell={setEditingCell} />,
    );
    act(() => getByLabelText("a").focus());
    act(() => getByLabelText("b").focus());
    expect(setEditingCell).toHaveBeenLastCalledWith({
      rowId: "r2",
      propertyId: "p2",
    });
  });

  it("clears editing when focus leaves the cell (commit/escape/click-away)", async () => {
    const setEditingCell = vi.fn();
    const { getByLabelText } = render(
      <Harness setEditingCell={setEditingCell} />,
    );
    const a = getByLabelText("a");
    act(() => a.focus());
    setEditingCell.mockClear();
    // The inline editor commits/unmounts: focus leaves the input (-> body) and
    // a focusout bubbles to the document. The tracker recomputes off the
    // settled activeElement, which is no longer a cell.
    act(() => {
      a.blur();
      fireEvent.focusOut(a);
    });
    await flush();
    expect(setEditingCell).toHaveBeenLastCalledWith(null);
  });

  it("clears editing on unmount of the view", () => {
    const setEditingCell = vi.fn();
    const { unmount } = render(<Harness setEditingCell={setEditingCell} />);
    setEditingCell.mockClear();
    unmount();
    expect(setEditingCell).toHaveBeenCalledWith(null);
  });
});
