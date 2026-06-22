import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";

const templatesHolder = vi.hoisted(() => ({
  value: [] as { id: string; name: string; icon: string | null }[],
}));
const propertiesHolder = vi.hoisted(() => ({ value: [] as unknown[] }));
const createMutate = vi.fn();
const updateMutate = vi.fn();
const deleteMutate = vi.fn();

vi.mock("@/features/database/queries/database-query.ts", () => ({
  useDatabaseTemplatesQuery: () => ({ data: templatesHolder.value }),
  useDatabasePropertiesQuery: () => ({ data: propertiesHolder.value }),
  useCreateTemplateMutation: () => ({ mutate: createMutate }),
  useUpdateTemplateMutation: () => ({ mutate: updateMutate }),
  useDeleteTemplateMutation: () => ({ mutate: deleteMutate }),
}));

// EmojiPicker lazy-loads emoji-mart; stub it so the modal renders synchronously.
vi.mock("@/components/ui/emoji-picker", () => ({
  default: ({ onEmojiSelect }: { onEmojiSelect: (e: unknown) => void }) => (
    <button
      type="button"
      aria-label="Pick emoji"
      onClick={() => onEmojiSelect({ native: "🐛" })}
    >
      icon
    </button>
  ),
}));

// The editor is lazy-loaded and pulls the full tiptap graph; stub it so these
// tests cover the modal's list/CRUD orchestration. The editor's own save
// contract is verified in template-row-editor.test.
vi.mock("./template-peek/template-row-editor", () => ({
  default: ({
    template,
    onClose,
  }: {
    template: { id: string } | null;
    onClose: () => void;
  }) => (
    <div>
      <span>Editing template {template?.id ?? "new"}</span>
      <button type="button" onClick={onClose}>
        Close editor
      </button>
    </div>
  ),
}));

import { TemplateManagerModal } from "./template-manager-modal";

function renderModal() {
  return render(
    <MantineProvider>
      <TemplateManagerModal opened databaseId="db1" onClose={vi.fn()} />
    </MantineProvider>,
  );
}

describe("TemplateManagerModal", () => {
  beforeEach(() => {
    templatesHolder.value = [];
    propertiesHolder.value = [];
    createMutate.mockReset();
    updateMutate.mockReset();
    deleteMutate.mockReset();
  });

  it("shows an empty state when the database has no templates", () => {
    renderModal();
    expect(screen.getByText("No templates")).toBeTruthy();
  });

  it("lists existing templates by name", () => {
    templatesHolder.value = [
      { id: "t1", name: "Bug", icon: null },
      { id: "t2", name: "Feature", icon: null },
    ];
    renderModal();
    expect(screen.getByText("Bug")).toBeTruthy();
    expect(screen.getByText("Feature")).toBeTruthy();
  });

  it("opens the rich editor for a new template", async () => {
    renderModal();
    fireEvent.click(screen.getByText("New template"));
    // Lazy-loaded editor host resolves asynchronously.
    expect(await screen.findByText("Editing template new")).toBeTruthy();
  });

  it("deletes a template when its delete control is clicked", () => {
    templatesHolder.value = [{ id: "t1", name: "Bug", icon: null }];
    renderModal();
    fireEvent.click(screen.getByLabelText("Delete template Bug"));
    expect(deleteMutate).toHaveBeenCalledWith({ templateId: "t1" });
  });

  it("opens an existing template in the editor and returns to the list on close", async () => {
    templatesHolder.value = [{ id: "t1", name: "Bug", icon: null }];
    renderModal();
    fireEvent.click(screen.getByLabelText("Edit template Bug"));
    expect(await screen.findByText("Editing template t1")).toBeTruthy();
    // Closing the editor returns to the template list.
    fireEvent.click(screen.getByText("Close editor"));
    expect(screen.getByText("New template")).toBeTruthy();
  });
});
