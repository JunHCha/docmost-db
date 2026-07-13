import { Drawer } from "@mantine/core";
import { ReactNode } from "react";
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

/** Fork: Notion-peek style row detail — a fixed right-hand panel with no
 *  overlay so the grid behind stays fully interactive. Renders the same
 *  interior as RowDetailModal (RowDetailBody); only the shell differs.
 *  Mantine's Drawer inner is pointer-events: none without an overlay, so
 *  clicks land on the page; the panel closes via Esc or its X button only. */
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

  return (
    <Drawer
      opened={!!common.openRowId}
      onClose={common.onClose}
      position="right"
      size="clamp(360px, 420px, 40vw)"
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
