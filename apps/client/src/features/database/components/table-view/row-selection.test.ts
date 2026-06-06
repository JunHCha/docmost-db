import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useRowSelection } from "./row-selection";

const ids = ["a", "b", "c", "d", "e"];

describe("useRowSelection", () => {
  it("starts with nothing selected", () => {
    const { result } = renderHook(() => useRowSelection(ids));
    expect(result.current.selectedIds.size).toBe(0);
    expect(result.current.isAllSelected).toBe(false);
    expect(result.current.isIndeterminate).toBe(false);
  });

  it("toggles a single row on and off", () => {
    const { result } = renderHook(() => useRowSelection(ids));
    act(() => result.current.toggle("b"));
    expect(result.current.selectedIds.has("b")).toBe(true);
    act(() => result.current.toggle("b"));
    expect(result.current.selectedIds.has("b")).toBe(false);
  });

  it("selects a range in visible order from the anchor (shift-click)", () => {
    const { result } = renderHook(() => useRowSelection(ids));
    // anchor on b
    act(() => result.current.toggle("b"));
    // shift-click to d selects b..d in visible order
    act(() => result.current.selectRange("d"));
    expect([...result.current.selectedIds].sort()).toEqual(["b", "c", "d"]);
  });

  it("selects a range regardless of click direction", () => {
    const { result } = renderHook(() => useRowSelection(ids));
    act(() => result.current.toggle("d"));
    act(() => result.current.selectRange("b"));
    expect([...result.current.selectedIds].sort()).toEqual(["b", "c", "d"]);
  });

  it("selectRange without an anchor selects only the target", () => {
    const { result } = renderHook(() => useRowSelection(ids));
    act(() => result.current.selectRange("c"));
    expect([...result.current.selectedIds]).toEqual(["c"]);
  });

  it("transitions none -> indeterminate -> all -> none via selectAll", () => {
    const { result } = renderHook(() => useRowSelection(ids));
    // partial selection => indeterminate
    act(() => result.current.toggle("a"));
    expect(result.current.isIndeterminate).toBe(true);
    expect(result.current.isAllSelected).toBe(false);
    // selectAll from partial => all
    act(() => result.current.selectAll());
    expect(result.current.isAllSelected).toBe(true);
    expect(result.current.isIndeterminate).toBe(false);
    expect(result.current.selectedIds.size).toBe(ids.length);
    // selectAll while all selected => clears
    act(() => result.current.selectAll());
    expect(result.current.selectedIds.size).toBe(0);
  });

  it("clear() empties the selection", () => {
    const { result } = renderHook(() => useRowSelection(ids));
    act(() => result.current.selectAll());
    act(() => result.current.clear());
    expect(result.current.selectedIds.size).toBe(0);
  });

  it("keeps only still-visible rows when the visible set shrinks (filter)", () => {
    const { result, rerender } = renderHook(
      ({ visible }) => useRowSelection(visible),
      { initialProps: { visible: ids } },
    );
    act(() => result.current.selectAll());
    expect(result.current.selectedIds.size).toBe(5);
    // a filter removes c, d, e from view
    rerender({ visible: ["a", "b"] });
    expect([...result.current.selectedIds].sort()).toEqual(["a", "b"]);
    expect(result.current.isAllSelected).toBe(true);
  });

  it("is not all-selected when the visible set is empty", () => {
    const { result } = renderHook(() => useRowSelection([]));
    expect(result.current.isAllSelected).toBe(false);
    expect(result.current.isIndeterminate).toBe(false);
  });
});
