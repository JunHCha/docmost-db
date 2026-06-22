import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";

const createMutate = vi.fn();
const updateMutate = vi.fn();

vi.mock("@/features/database/queries/database-query.ts", () => ({
  useCreateTemplateMutation: () => ({ mutate: createMutate }),
  useUpdateTemplateMutation: () => ({ mutate: updateMutate }),
}));

// Stub the emoji picker (lazy emoji-mart) so the editor renders synchronously.
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

// Thin tiptap stub: the component contract under test is the save payload
// (name/icon/propertyValues + content from editor.getJSON()), not real editing.
const editorJSON = {
  type: "doc",
  content: [
    { type: "heading", content: [{ type: "text", text: "Hi" }] },
  ],
};
vi.mock("@tiptap/react", () => ({
  useEditor: () => ({
    getJSON: () => editorJSON,
    commands: { focus: vi.fn() },
  }),
  EditorContent: () => <div data-testid="editor-content" />,
}));
vi.mock("@/features/editor/extensions/extensions", () => ({
  templateExtensions: [],
}));
vi.mock("@/features/editor/components/bubble-menu/bubble-menu", () => ({
  EditorBubbleMenu: () => null,
}));
vi.mock("@/features/editor/components/link/link-menu", () => ({
  EditorLinkMenu: () => null,
}));
vi.mock("@/features/editor/styles/index.css", () => ({}));

import { TemplateRowEditor } from "./template-row-editor";
import {
  IDatabaseProperty,
  IDatabaseTemplate,
} from "@/features/database/types/database.types.ts";

const properties: IDatabaseProperty[] = [
  {
    id: "p1",
    databaseId: "db1",
    name: "Status",
    type: "text",
    config: {},
    position: "a0",
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  } as any,
];

function renderEditor(template: IDatabaseTemplate | null, onClose = vi.fn()) {
  render(
    <MantineProvider>
      <TemplateRowEditor
        databaseId="db1"
        properties={properties}
        template={template}
        onClose={onClose}
      />
    </MantineProvider>,
  );
  return { onClose };
}

describe("TemplateRowEditor", () => {
  beforeEach(() => {
    createMutate.mockReset();
    updateMutate.mockReset();
  });

  it("marks the editor as a template with an accent badge", () => {
    renderEditor(null);
    expect(screen.getByText("Editing template")).toBeTruthy();
  });

  it("shows each property preset with its data type icon", () => {
    const { container } = render(
      <MantineProvider>
        <TemplateRowEditor
          databaseId="db1"
          properties={properties}
          template={null}
          onClose={vi.fn()}
        />
      </MantineProvider>,
    );
    expect(screen.getByText("Status")).toBeTruthy();
    expect(container.querySelector("svg.tabler-icon-letter-case")).toBeTruthy();
  });

  it("creates a template with the rich body from getJSON on save", () => {
    const { onClose } = renderEditor(null);
    fireEvent.change(screen.getByLabelText("Template name"), {
      target: { value: "Meeting" },
    });
    fireEvent.change(screen.getByLabelText("Status"), {
      target: { value: "todo" },
    });
    fireEvent.click(screen.getByText("Save"));

    expect(createMutate).toHaveBeenCalledTimes(1);
    expect(createMutate.mock.calls[0][0]).toMatchObject({
      databaseId: "db1",
      name: "Meeting",
      propertyValues: { p1: { type: "text", value: "todo" } },
      content: editorJSON,
    });
    expect(onClose).toHaveBeenCalled();
  });

  it("updates an existing template by id", () => {
    const existing: IDatabaseTemplate = {
      id: "t1",
      databaseId: "db1",
      name: "Old",
      icon: "📋",
      propertyValues: {},
      content: null,
      position: "a0",
      workspaceId: "w1",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    renderEditor(existing);
    fireEvent.click(screen.getByText("Save"));
    expect(updateMutate).toHaveBeenCalledTimes(1);
    expect(updateMutate.mock.calls[0][0]).toMatchObject({
      templateId: "t1",
      name: "Old",
    });
    expect(createMutate).not.toHaveBeenCalled();
  });

  it("closes without saving on cancel", () => {
    const { onClose } = renderEditor(null);
    fireEvent.click(screen.getByText("Cancel"));
    expect(onClose).toHaveBeenCalled();
    expect(createMutate).not.toHaveBeenCalled();
  });
});
