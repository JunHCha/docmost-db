import React, { useRef } from "react";
import { useTranslation } from "react-i18next";

interface ColumnResizeHandleProps {
  // Current persisted width (px) of the column this handle belongs to.
  width: number;
  // Commit the new width once, on pointer-up (only if it actually changed).
  onResize: (width: number) => void;
  minWidth?: number;
}

// Drag handle on a column's right edge. While dragging it previews the new width
// imperatively on the parent <th> (pointer capture keeps events flowing even when
// the cursor leaves the 6px hit area) and commits once on pointer-up. Shared by
// the property columns (ColumnHeader) and the leading Title column so both resize
// identically.
export function ColumnResizeHandle({
  width,
  onResize,
  minWidth = 80,
}: ColumnResizeHandleProps) {
  const { t } = useTranslation();
  const resizeRef = useRef<{ startX: number; startWidth: number } | null>(null);

  function resizeWidth(clientX: number): number {
    const r = resizeRef.current;
    if (!r) return width;
    return Math.max(minWidth, Math.round(r.startWidth + (clientX - r.startX)));
  }

  function onPointerDown(e: React.PointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    resizeRef.current = { startX: e.clientX, startWidth: width };
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!resizeRef.current) return;
    const th = e.currentTarget.closest("th");
    if (th) (th as HTMLElement).style.width = `${resizeWidth(e.clientX)}px`;
  }

  function onPointerUp(e: React.PointerEvent) {
    if (!resizeRef.current) return;
    const next = resizeWidth(e.clientX);
    resizeRef.current = null;
    if (next !== width) onResize(next);
  }

  return (
    <div
      role="separator"
      aria-label={t("Resize column")}
      aria-orientation="vertical"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      style={{
        position: "absolute",
        top: 0,
        bottom: 0,
        right: -3,
        width: 6,
        cursor: "col-resize",
        touchAction: "none",
      }}
    />
  );
}

export default ColumnResizeHandle;
