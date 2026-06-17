import { Modal, ScrollArea } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { usePagePeek } from "./use-page-peek.tsx";
import { PeekHostControls } from "./peek-host-controls.tsx";
import { RelationPagePeek } from "./relation-page-peek.tsx";

// Mounted once globally; renders the peek as a wide centered modal when the
// modal host is active. The aside host is rendered by the Aside component.
//
// Kept separate from use-page-peek so the (light) hook can be imported by cells
// without dragging the page editor into table-view test graphs.
export function RelationPeekModalHost() {
  const { t } = useTranslation();
  const { pageId, host, close } = usePagePeek();
  const opened = host === "modal" && !!pageId;

  return (
    <Modal.Root
      size={1100}
      radius="lg"
      opened={opened}
      onClose={close}
      aria-label={t("Preview")}
    >
      {/* No dim: a transparent overlay keeps click-outside-to-close while the
          page behind stays fully visible; the modal is set apart by its border
          and shadow instead of a darkened backdrop (#94). */}
      <Modal.Overlay backgroundOpacity={0} />
      <Modal.Content
        style={{
          overflow: "hidden",
          border: "1px solid var(--mantine-color-default-border)",
          boxShadow: "var(--mantine-shadow-xl)",
        }}
      >
        <Modal.Header>
          <PeekHostControls />
        </Modal.Header>
        <Modal.Body p={0}>
          <ScrollArea h="72vh" w="100%" scrollbarSize={5}>
            {pageId && <RelationPagePeek pageId={pageId} />}
          </ScrollArea>
        </Modal.Body>
      </Modal.Content>
    </Modal.Root>
  );
}
