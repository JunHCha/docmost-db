import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";

const createMutate = vi.fn();
const updateMutate = vi.fn();
let rowsData: any[] = [];

// The template editor now renders the grid's per-type cell editors in
// controlled mode, so the value-mutation hooks they read must be stubbed too —
// they should never fire (controlled cells emit onChange instead, #112).
const setValueMutate = vi.fn();
const clearValueMutate = vi.fn();

// Database info resolves the embed picker's spaceId from the template's
// databaseId. Tests override `dbInfoData` to exercise the unresolved case.
let dbInfoData: any = { database: { spaceId: "space-1" } };

vi.mock("@/features/database/queries/database-query.ts", () => ({
  useCreateTemplateMutation: () => ({ mutate: createMutate }),
  useUpdateTemplateMutation: () => ({ mutate: updateMutate }),
  useSetValueMutation: () => ({ mutate: setValueMutate }),
  useClearValueMutation: () => ({ mutate: clearValueMutate }),
  useDatabaseRowsQuery: () => ({ data: rowsData }),
  useDatabaseInfoByIdQuery: () => ({ data: dbInfoData }),
  useDefaultViewId: () => "v1",
  useUpdatePropertyMutation: () => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn().mockResolvedValue(undefined),
  }),
}));

// The picker modal is exercised through its props (open state + onConfirm), not
// its internal database list query, so stub it to a minimal confirm trigger.
let lastPickerSpaceId: string | undefined;
vi.mock(
  "@/features/database/components/embed/database-picker-modal.tsx",
  () => ({
    DatabasePickerModal: ({ opened, spaceId, onConfirm }: any) => {
      lastPickerSpaceId = spaceId;
      if (!opened) return null;
      return (
        <button
          type="button"
          aria-label="Confirm DB pick"
          onClick={() => onConfirm({ databaseId: "picked-db" })}
        >
          confirm
        </button>
      );
    },
  }),
);

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
const insertDatabaseView = vi.fn();
let lastEditor: any;
vi.mock("@tiptap/react", () => ({
  useEditor: (options: any) => {
    const editor: any = {
      storage: {} as Record<string, unknown>,
      getJSON: () => editorJSON,
      commands: { focus: vi.fn(), insertDatabaseView },
    };
    // Mirror tiptap: run the onCreate callback once so the component can stamp
    // its templateEditorId onto editor.storage for event scoping.
    options?.onCreate?.({ editor });
    lastEditor = editor;
    return editor;
  },
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

function prop(over: Partial<IDatabaseProperty>): IDatabaseProperty {
  return {
    id: "p1",
    databaseId: "db1",
    name: "Status",
    type: "text",
    config: {},
    position: "a0",
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...over,
  } as IDatabaseProperty;
}

const properties: IDatabaseProperty[] = [prop({ id: "p1", name: "Status" })];

function renderEditor(
  template: IDatabaseTemplate | null,
  props: IDatabaseProperty[] = properties,
  onClose = vi.fn(),
) {
  render(
    <MantineProvider>
      <TemplateRowEditor
        databaseId="db1"
        properties={props}
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
    setValueMutate.mockReset();
    clearValueMutate.mockReset();
    insertDatabaseView.mockReset();
    rowsData = [];
    dbInfoData = { database: { spaceId: "space-1" } };
    lastEditor = undefined;
    lastPickerSpaceId = undefined;
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
    // Controlled text cell: click to enter edit mode, type, blur to commit.
    fireEvent.click(screen.getByText("Empty"));
    fireEvent.change(screen.getByLabelText("Status"), {
      target: { value: "todo" },
    });
    fireEvent.blur(screen.getByLabelText("Status"));
    fireEvent.click(screen.getByText("Save"));

    expect(createMutate).toHaveBeenCalledTimes(1);
    expect(createMutate.mock.calls[0][0]).toMatchObject({
      databaseId: "db1",
      name: "Meeting",
      propertyValues: { p1: { type: "text", value: "todo" } },
      content: editorJSON,
    });
    // The cell ran in controlled mode — no pageId-based value mutation fired.
    expect(setValueMutate).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("edits a select value into the save payload", () => {
    renderEditor(null, [
      prop({
        id: "p1",
        name: "Stage",
        type: "select",
        config: {
          options: [
            { id: "o1", label: "Todo", color: "blue" },
            { id: "o2", label: "Doing", color: "green" },
          ],
        },
      }),
    ]);
    fireEvent.click(screen.getByLabelText("Stage"));
    fireEvent.click(screen.getByText("Doing"));
    fireEvent.click(screen.getByText("Save"));
    expect(createMutate.mock.calls[0][0].propertyValues).toEqual({
      p1: { type: "select", value: "o2" },
    });
    expect(setValueMutate).not.toHaveBeenCalled();
  });

  it("edits a date value into the save payload", () => {
    renderEditor(null, [prop({ id: "p1", name: "Due", type: "date" })]);
    fireEvent.click(screen.getByText("Empty"));
    fireEvent.change(screen.getByLabelText("Due"), {
      target: { value: "June 1, 2026" },
    });
    fireEvent.click(screen.getByText("Save"));
    expect(createMutate.mock.calls[0][0].propertyValues).toEqual({
      p1: { type: "date", value: "2026-06-01" },
    });
  });

  it("picks a relation page into the save payload", () => {
    rowsData = [{ row: { id: "r1", title: "Alpha" }, values: [] }];
    renderEditor(null, [
      prop({
        id: "p1",
        name: "Project",
        type: "relation",
        config: { targetDatabaseId: "target-db" },
      }),
    ]);
    fireEvent.click(screen.getByLabelText("Project"));
    const option = screen
      .getAllByRole("option")
      .find((el) => el.textContent?.includes("Alpha"));
    fireEvent.click(option!);
    fireEvent.click(screen.getByText("Save"));
    expect(createMutate.mock.calls[0][0].propertyValues).toEqual({
      p1: { type: "relation", value: ["r1"] },
    });
    expect(setValueMutate).not.toHaveBeenCalled();
  });

  it("restores existing relation chips when reopened for edit", () => {
    rowsData = [
      { row: { id: "r1", title: "Alpha" }, values: [] },
      { row: { id: "r2", title: "Beta" }, values: [] },
    ];
    const existing: IDatabaseTemplate = {
      id: "t1",
      databaseId: "db1",
      name: "Old",
      icon: null,
      propertyValues: { p1: { type: "relation", value: ["r1"] } },
      content: null,
      embedViews: null,
      position: "a0",
      workspaceId: "w1",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    renderEditor(existing, [
      prop({
        id: "p1",
        name: "Project",
        type: "relation",
        config: { targetDatabaseId: "target-db" },
      }),
    ]);
    expect(screen.getByText("Alpha")).toBeTruthy();
  });

  it("preserves an existing template's embed views in the save payload", () => {
    const existing: IDatabaseTemplate = {
      id: "t1",
      databaseId: "db1",
      name: "Old",
      icon: null,
      propertyValues: {},
      content: null,
      embedViews: {
        "embed-1": [
          { name: "Default", type: "table", config: {}, isDefault: true },
        ],
      },
      position: "a0",
      workspaceId: "w1",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    renderEditor(existing);
    fireEvent.click(screen.getByText("Save"));
    expect(updateMutate.mock.calls[0][0].embedViews).toEqual(
      existing.embedViews,
    );
  });

  it("updates an existing template by id", () => {
    const existing: IDatabaseTemplate = {
      id: "t1",
      databaseId: "db1",
      name: "Old",
      icon: "📋",
      propertyValues: {},
      content: null,
      embedViews: null,
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

  // --- Database embed view insertion (#113) ---

  function dispatchOpenPicker(detail: unknown) {
    act(() => {
      document.dispatchEvent(
        new CustomEvent("openDatabasePickerFromEditor", { detail }),
      );
    });
  }

  it("opens the picker and inserts a database view on its own scoped event", () => {
    renderEditor(null);
    const templateEditorId = lastEditor.storage.templateEditorId as string;
    expect(templateEditorId).toBeTruthy();

    // No picker until the slash event for this editor arrives.
    expect(screen.queryByLabelText("Confirm DB pick")).toBeNull();

    dispatchOpenPicker({ templateEditorId });
    fireEvent.click(screen.getByLabelText("Confirm DB pick"));

    expect(insertDatabaseView).toHaveBeenCalledWith({ databaseId: "picked-db" });
    // Modal closes after a confirm.
    expect(screen.queryByLabelText("Confirm DB pick")).toBeNull();
  });

  it("resolves the picker spaceId from the template's databaseId", () => {
    renderEditor(null);
    const templateEditorId = lastEditor.storage.templateEditorId as string;
    dispatchOpenPicker({ templateEditorId });
    expect(lastPickerSpaceId).toBe("space-1");
  });

  it("ignores a page-scoped event (does not open the template picker)", () => {
    renderEditor(null);
    dispatchOpenPicker({ pageId: "page-1" });
    expect(screen.queryByLabelText("Confirm DB pick")).toBeNull();
  });

  it("ignores another template editor's event", () => {
    renderEditor(null);
    dispatchOpenPicker({ templateEditorId: "some-other-template" });
    expect(screen.queryByLabelText("Confirm DB pick")).toBeNull();
  });

  it("does not render the picker modal until spaceId resolves", () => {
    dbInfoData = { database: null };
    renderEditor(null);
    const templateEditorId = lastEditor.storage.templateEditorId as string;
    dispatchOpenPicker({ templateEditorId });
    // Even though the open event fired, an unresolved spaceId withholds the modal.
    expect(screen.queryByLabelText("Confirm DB pick")).toBeNull();
  });
});
