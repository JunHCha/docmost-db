import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";

const templatesHolder = vi.hoisted(() => ({
  value: [] as { id: string; name: string; icon: string | null }[],
}));
const deleteMutate = vi.fn();

vi.mock("@/features/database/queries/database-query.ts", () => ({
  useDatabaseTemplatesQuery: () => ({ data: templatesHolder.value }),
  useDatabasePropertiesQuery: () => ({ data: [] }),
  useDeleteTemplateMutation: () => ({ mutate: deleteMutate }),
}));

// The editor is lazy-loaded and pulls the full tiptap graph; stub it so these
// tests cover the dropdown's list/CRUD orchestration. The editor's own save
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

import { TemplateManagerMenu } from "./template-manager-menu";

function renderMenu() {
  return render(
    <MantineProvider>
      <TemplateManagerMenu databaseId="db1" />
    </MantineProvider>,
  );
}

function openList() {
  fireEvent.click(screen.getByRole("button", { name: /templates/i }));
}

describe("TemplateManagerMenu", () => {
  beforeEach(() => {
    templatesHolder.value = [];
    deleteMutate.mockReset();
  });

  it("shows an empty state in the dropdown when there are no templates", async () => {
    renderMenu();
    openList();
    // Popover dropdown renders into a portal after a tick.
    expect(await screen.findByText("No templates")).toBeTruthy();
  });

  it("lists existing templates in the dropdown", async () => {
    templatesHolder.value = [
      { id: "t1", name: "Bug", icon: null },
      { id: "t2", name: "Feature", icon: null },
    ];
    renderMenu();
    openList();
    expect(await screen.findByText("Bug")).toBeTruthy();
    expect(screen.getByText("Feature")).toBeTruthy();
  });

  it("deletes a template from the dropdown", async () => {
    templatesHolder.value = [{ id: "t1", name: "Bug", icon: null }];
    renderMenu();
    openList();
    fireEvent.click(await screen.findByLabelText("Delete template Bug"));
    expect(deleteMutate).toHaveBeenCalledWith({ templateId: "t1" });
  });

  it("opens the editor for a new template", async () => {
    renderMenu();
    openList();
    fireEvent.click(await screen.findByText("New template"));
    expect(await screen.findByText("Editing template new")).toBeTruthy();
  });

  it("opens an existing template in the editor and returns on close", async () => {
    templatesHolder.value = [{ id: "t1", name: "Bug", icon: null }];
    renderMenu();
    openList();
    fireEvent.click(await screen.findByLabelText("Edit template Bug"));
    expect(await screen.findByText("Editing template t1")).toBeTruthy();
    fireEvent.click(screen.getByText("Close editor"));
    // Editor dismissed.
    expect(screen.queryByText("Editing template t1")).toBeNull();
  });
});
