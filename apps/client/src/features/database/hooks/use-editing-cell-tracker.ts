import { RefObject, useEffect } from "react";
import { DatabaseEditingCell } from "./use-database-collab";

/**
 * Tracks which cell the local user is editing and publishes it via
 * setEditingCell (#55 Phase 4). Uses document-level focus events rather than
 * per-cell onBlur because a cell's inline editor (e.g. TextCell) unmounts itself
 * on commit, which swallows React's onBlurCapture and would otherwise leave a
 * stale "editing" presence stuck on the cell.
 *
 * Cells mark themselves with data-db-cell + data-row-id + data-property-id.
 * Only cells inside `rootRef` count, so multiple DB views (inline embeds) on one
 * page don't clobber each other's presence.
 */
export function useEditingCellTracker(
  rootRef: RefObject<HTMLElement>,
  setEditingCell: (cell: DatabaseEditingCell | null) => void,
) {
  useEffect(() => {
    const compute = () => {
      const active = document.activeElement;
      const cell =
        active instanceof HTMLElement
          ? active.closest<HTMLElement>("[data-db-cell]")
          : null;
      if (
        cell &&
        rootRef.current?.contains(cell) &&
        cell.dataset.rowId &&
        cell.dataset.propertyId
      ) {
        setEditingCell({
          rowId: cell.dataset.rowId,
          propertyId: cell.dataset.propertyId,
        });
      } else {
        setEditingCell(null);
      }
    };
    // On focusout the new activeElement isn't settled yet (it's transiently
    // <body>), so recompute on the next tick.
    const onFocusOut = () => setTimeout(compute, 0);
    document.addEventListener("focusin", compute);
    document.addEventListener("focusout", onFocusOut);
    return () => {
      document.removeEventListener("focusin", compute);
      document.removeEventListener("focusout", onFocusOut);
      setEditingCell(null);
    };
  }, [rootRef, setEditingCell]);
}
