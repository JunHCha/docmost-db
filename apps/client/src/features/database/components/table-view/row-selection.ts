import { useCallback, useMemo, useRef, useState } from "react";

export interface RowSelection {
  selectedIds: Set<string>;
  isAllSelected: boolean;
  isIndeterminate: boolean;
  toggle: (id: string) => void;
  selectRange: (id: string) => void;
  selectAll: () => void;
  clear: () => void;
}

// Tracks multi-select state over the *visible* rows (the filtered/sorted result
// is the source of truth). Selection is pruned to what is still visible so a
// filter that hides a row also drops it from the selection.
export function useRowSelection(visibleRowIds: string[]): RowSelection {
  const [raw, setRaw] = useState<Set<string>>(() => new Set());
  const anchorRef = useRef<string | null>(null);

  const visible = useMemo(() => new Set(visibleRowIds), [visibleRowIds]);

  // Effective selection is always intersected with the visible rows.
  const selectedIds = useMemo(() => {
    const next = new Set<string>();
    for (const id of raw) {
      if (visible.has(id)) next.add(id);
    }
    return next;
  }, [raw, visible]);

  const toggle = useCallback((id: string) => {
    anchorRef.current = id;
    setRaw((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectRange = useCallback(
    (id: string) => {
      const anchor = anchorRef.current;
      if (anchor === null) {
        anchorRef.current = id;
        setRaw(new Set([id]));
        return;
      }
      const from = visibleRowIds.indexOf(anchor);
      const to = visibleRowIds.indexOf(id);
      if (from === -1 || to === -1) {
        setRaw((prev) => new Set(prev).add(id));
        return;
      }
      const [lo, hi] = from <= to ? [from, to] : [to, from];
      setRaw((prev) => {
        const next = new Set(prev);
        for (let i = lo; i <= hi; i += 1) next.add(visibleRowIds[i]);
        return next;
      });
    },
    [visibleRowIds],
  );

  const selectAll = useCallback(() => {
    setRaw((prev) => {
      const allSelected =
        visibleRowIds.length > 0 &&
        visibleRowIds.every((id) => prev.has(id));
      return allSelected ? new Set() : new Set(visibleRowIds);
    });
  }, [visibleRowIds]);

  const clear = useCallback(() => setRaw(new Set()), []);

  const isAllSelected =
    visibleRowIds.length > 0 && selectedIds.size === visibleRowIds.length;
  const isIndeterminate = selectedIds.size > 0 && !isAllSelected;

  return {
    selectedIds,
    isAllSelected,
    isIndeterminate,
    toggle,
    selectRange,
    selectAll,
    clear,
  };
}
