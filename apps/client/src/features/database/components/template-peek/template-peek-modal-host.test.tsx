import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";

// Stub the editor body so the host's open/close/host-gating is what's tested,
// not the tiptap editor graph.
vi.mock("./template-peek-body", () => ({
  TemplatePeekBody: ({
    databaseId,
    templateId,
  }: {
    databaseId: string;
    templateId: string | null;
  }) => (
    <div>
      peek body {databaseId}/{templateId ?? "new"}
    </div>
  ),
}));

import { TemplatePeekModalHost } from "./template-peek-modal-host";
import { useTemplatePeek } from "./use-template-peek";

function Harness() {
  const { open, setHost } = useTemplatePeek();
  return (
    <>
      <button type="button" onClick={() => open("db1", "t1", "modal")}>
        open modal
      </button>
      <button type="button" onClick={() => setHost("aside")}>
        to aside
      </button>
      <TemplatePeekModalHost />
    </>
  );
}

function renderHost() {
  return render(
    <MantineProvider>
      <Harness />
    </MantineProvider>,
  );
}

describe("TemplatePeekModalHost", () => {
  it("is closed until a template peek is opened in the modal host", () => {
    renderHost();
    expect(screen.queryByText(/peek body/)).toBeNull();
  });

  it("renders the editor body when opened in the modal host", async () => {
    renderHost();
    fireEvent.click(screen.getByText("open modal"));
    expect(await screen.findByText("peek body db1/t1")).toBeTruthy();
  });

  it("hides when the host switches away from modal (to aside)", async () => {
    renderHost();
    fireEvent.click(screen.getByText("open modal"));
    expect(await screen.findByText("peek body db1/t1")).toBeTruthy();
    fireEvent.click(screen.getByText("to aside"));
    // The modal host no longer owns the open peek.
    expect(screen.queryByText("peek body db1/t1")).toBeNull();
  });
});
