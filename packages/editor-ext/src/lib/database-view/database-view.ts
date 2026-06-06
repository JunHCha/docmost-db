import { mergeAttributes, Node } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";

export interface DatabaseViewOptions {
  HTMLAttributes: Record<string, any>;
  view: any;
}

export interface DatabaseViewAttributes {
  databaseId?: string | null;
  viewId?: string | null;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    databaseView: {
      insertDatabaseView: (attributes: DatabaseViewAttributes) => ReturnType;
    };
  }
}

export const DatabaseView = Node.create<DatabaseViewOptions>({
  name: "databaseView",

  addOptions() {
    return {
      HTMLAttributes: {},
      view: null,
    };
  },

  group: "block",
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      databaseId: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-database-id"),
        renderHTML: (attrs) =>
          attrs.databaseId ? { "data-database-id": attrs.databaseId } : {},
      },
      viewId: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-view-id"),
        renderHTML: (attrs) =>
          attrs.viewId ? { "data-view-id": attrs.viewId } : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: `div[data-type="${this.name}"]` }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(
        { "data-type": this.name },
        this.options.HTMLAttributes,
        HTMLAttributes,
      ),
    ];
  },

  addCommands() {
    return {
      insertDatabaseView:
        (attributes) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: attributes,
          }),
    };
  },

  addNodeView() {
    if (!this.options.view) return null;
    this.editor.isInitialized = true;
    return ReactNodeViewRenderer(this.options.view);
  },
});
