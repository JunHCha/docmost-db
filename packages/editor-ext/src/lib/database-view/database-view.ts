import { mergeAttributes, Node } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";

export interface DatabaseViewOptions {
  HTMLAttributes: Record<string, any>;
  view: any;
}

export interface DatabaseViewAttributes {
  databaseId?: string | null;
  viewId?: string | null;
  // The embed's own view scope (issue #39). Generated on insert so each embed
  // owns its views without mutating the original database's view set.
  embedId?: string | null;
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
      embedId: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-embed-id"),
        renderHTML: (attrs) =>
          attrs.embedId ? { "data-embed-id": attrs.embedId } : {},
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
            // Give every inserted embed its own view scope (issue #39) so its
            // views are isolated from the original database. Preserve an
            // explicitly supplied embedId (e.g. duplicated node).
            attrs: {
              ...attributes,
              embedId: attributes.embedId ?? crypto.randomUUID(),
            },
          }),
    };
  },

  addNodeView() {
    if (!this.options.view) return null;
    this.editor.isInitialized = true;
    return ReactNodeViewRenderer(this.options.view);
  },
});
