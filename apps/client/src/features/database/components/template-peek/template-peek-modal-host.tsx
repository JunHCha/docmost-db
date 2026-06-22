import { Modal } from "@mantine/core";
import { useTemplatePeek } from "./use-template-peek";
import { TemplatePeekBody } from "./template-peek-body";
import { TemplatePeekHostControls } from "./template-peek-host-controls";

// Mounted once globally; renders the template editor as a centered modal when
// the modal host is active (#102).
export function TemplatePeekModalHost() {
  const { databaseId, templateId, host, close } = useTemplatePeek();
  const opened = host === "modal" && !!databaseId;

  return (
    <Modal
      opened={opened}
      onClose={close}
      title={null}
      size={760}
      padding={0}
      // Match the editor's accent border radius sitting flush at the edge.
      radius="lg"
      withCloseButton={false}
    >
      {opened && databaseId && (
        <TemplatePeekBody
          databaseId={databaseId}
          templateId={templateId}
          onClose={close}
          headerControls={<TemplatePeekHostControls />}
        />
      )}
    </Modal>
  );
}

export default TemplatePeekModalHost;
