import { Drawer } from "@mantine/core";
import { ReactNode, useCallback, useRef, useState } from "react";
import {
  RowDetailBody,
  RowDetailCommonProps,
  RowDetailSkeleton,
  useRowDetailState,
} from "./row-detail-body";
import classes from "@/ee/base/styles/row-detail-modal.module.css";

type RowDetailPanelProps = RowDetailCommonProps & {
  /** Extra control (e.g. the panel/modal mode toggle) shown in the top bar. */
  topBarExtra?: ReactNode;
};

const WIDTH_STORAGE_KEY = "docmost:base-row-panel-width";
const MIN_WIDTH = 320;
const DEFAULT_WIDTH = 420;

function maxWidth(): number {
  return Math.min(900, Math.floor(window.innerWidth * 0.7));
}

function clampWidth(width: number): number {
  return Math.min(Math.max(width, MIN_WIDTH), maxWidth());
}

function readStoredWidth(): number {
  try {
    const raw = Number(localStorage.getItem(WIDTH_STORAGE_KEY));
    return Number.isFinite(raw) && raw > 0 ? clampWidth(raw) : DEFAULT_WIDTH;
  } catch {
    return DEFAULT_WIDTH;
  }
}

/** Fork: Notion-peek style row detail — a fixed right-hand panel with no
 *  overlay so the grid behind stays fully interactive. Renders the same
 *  interior as RowDetailModal (RowDetailBody); only the shell differs.
 *  Mantine's Drawer inner is pointer-events: none without an overlay, so
 *  clicks land on the page; the panel closes via Esc or its X button only.
 *  The left edge is a drag handle; the chosen width persists per browser. */
export function RowDetailPanel({
  topBarExtra,
  ...common
}: RowDetailPanelProps) {
  const state = useRowDetailState({
    ...common,
    contentClassName: classes.panelContent,
    // The grid keeps focus and its own arrow-key semantics behind the panel.
    scopeArrowKeys: true,
  });

  const [width, setWidth] = useState<number>(readStoredWidth);
  const draggingRef = useRef(false);

  const handleResizeStart = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      draggingRef.current = true;
      const target = event.currentTarget;
      target.setPointerCapture(event.pointerId);

      const onMove = (e: PointerEvent) => {
        if (!draggingRef.current) return;
        setWidth(clampWidth(window.innerWidth - e.clientX));
      };
      const onUp = (e: PointerEvent) => {
        draggingRef.current = false;
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        try {
          localStorage.setItem(
            WIDTH_STORAGE_KEY,
            String(clampWidth(window.innerWidth - e.clientX)),
          );
        } catch {
          // Storage unavailable: the width still applies for this session.
        }
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [],
  );

  return (
    <Drawer
      opened={!!common.openRowId}
      onClose={common.onClose}
      position="right"
      size={width}
      withOverlay={false}
      trapFocus={false}
      lockScroll={false}
      returnFocus={false}
      withCloseButton={false}
      closeOnEscape={false}
      closeOnClickOutside={false}
      padding={0}
      title={null}
      classNames={{ content: classes.panelContent }}
    >
      <div
        className={classes.panelResizeHandle}
        onPointerDown={handleResizeStart}
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize panel"
      />
      {state.row ? (
        <RowDetailBody
          base={common.base}
          rows={common.rows}
          state={state}
          topBarExtra={topBarExtra}
        />
      ) : (
        <RowDetailSkeleton base={common.base} />
      )}
    </Drawer>
  );
}
