import { Modal } from "@mantine/core";
import { ReactNode } from "react";
import {
  RowDetailBody,
  RowDetailCommonProps,
  RowDetailSkeleton,
  useRowDetailState,
} from "./row-detail-body";
import classes from "@/ee/base/styles/row-detail-modal.module.css";

type RowDetailModalProps = RowDetailCommonProps & {
  /** Extra control (e.g. the panel/modal mode toggle) shown in the top bar. */
  topBarExtra?: ReactNode;
};

export function RowDetailModal({
  topBarExtra,
  ...common
}: RowDetailModalProps) {
  const state = useRowDetailState({
    ...common,
    contentClassName: classes.modalContent,
  });

  return (
    <Modal
      opened={!!common.openRowId}
      onClose={common.onClose}
      size="lg"
      centered
      withCloseButton={false}
      closeOnEscape={false}
      closeOnClickOutside={!state.openMenuId}
      padding={0}
      radius="md"
      title={null}
      classNames={{ content: classes.modalContent }}
      removeScrollProps={{ noIsolation: true }}
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
    </Modal>
  );
}
