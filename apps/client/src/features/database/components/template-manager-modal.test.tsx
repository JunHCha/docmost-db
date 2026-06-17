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

  it("creates a template via the new-template form's save", () => {
    renderModal();
    fireEvent.click(screen.getByText("New template"));
    const nameInput = screen.getByLabelText("Template name") as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: "Bug" } });
    fireEvent.click(screen.getByText("Save"));
    expect(createMutate).toHaveBeenCalledWith(
      expect.objectContaining({ databaseId: "db1", name: "Bug" }),
    );
  });

  it("deletes a template when its delete control is clicked", () => {
    templatesHolder.value = [{ id: "t1", name: "Bug", icon: null }];
    renderModal();
    fireEvent.click(screen.getByLabelText("Delete template Bug"));
    expect(deleteMutate).toHaveBeenCalledWith({ templateId: "t1" });
  });

  it("opens a template for editing and saves name changes via update", () => {
    templatesHolder.value = [{ id: "t1", name: "Bug", icon: null }];
    renderModal();
    fireEvent.click(screen.getByLabelText("Edit template Bug"));
    const nameInput = screen.getByLabelText("Template name") as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: "Defect" } });
    fireEvent.click(screen.getByText("Save"));
    expect(updateMutate).toHaveBeenCalledWith(
      expect.objectContaining({ templateId: "t1", name: "Defect" }),
    );
  });
});
