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

// Editing is driven through the template peek (rendered by global hosts), so the
// menu only needs to request the peek to open. The editor's save contract is
// verified in template-row-editor.test.
const openPeek = vi.fn();
vi.mock("./template-peek/use-template-peek", () => ({
  useTemplatePeek: () => ({ open: openPeek }),
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
    openPeek.mockReset();
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

  it("opens the peek for a new template (modal host)", async () => {
    renderMenu();
    openList();
    fireEvent.click(await screen.findByText("New template"));
    expect(openPeek).toHaveBeenCalledWith("db1", null, "modal");
  });

  it("opens an existing template in the peek (modal host)", async () => {
    templatesHolder.value = [{ id: "t1", name: "Bug", icon: null }];
    renderMenu();
    openList();
    fireEvent.click(await screen.findByLabelText("Edit template Bug"));
    expect(openPeek).toHaveBeenCalledWith("db1", "t1", "modal");
  });
});
