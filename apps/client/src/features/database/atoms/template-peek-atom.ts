import { atom } from "jotai";

// Where the database row-template editor is shown (#102). Like the relation page
// peek it can float as a right-side overlay (aside) or a centered modal; "page"
// means it's open on its own full-page route instead of an overlay.
export type TemplatePeekHost = "modal" | "aside" | "page";

export interface TemplatePeekState {
  // The owning database, or null when no peek is open.
  databaseId: string | null;
  // The template being edited, or null (with databaseId set) when creating new.
  templateId: string | null;
  host: TemplatePeekHost;
}

export const templatePeekAtom = atom<TemplatePeekState>({
  databaseId: null,
  templateId: null,
  host: "modal",
});
