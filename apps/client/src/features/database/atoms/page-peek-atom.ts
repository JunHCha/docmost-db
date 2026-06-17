import { atom } from "jotai";
import { atomWithWebStorage } from "@/lib/jotai-helper.ts";

// Where a relation page preview ("peek", #94) is rendered. Aside is the default
// (a right-side overlay covering ~half the screen); modal is the wide centered
// view.
export type PeekHost = "aside" | "modal";

export interface PagePeekState {
  // The previewed page, or null when no peek is open.
  pageId: string | null;
  host: PeekHost;
}

export const pagePeekAtom = atom<PagePeekState>({
  pageId: null,
  host: "aside",
});

// Width (px) of the aside-host overlay. Defaults to half the viewport so the
// peek opens as a half-screen overlay; persisted once the user resizes it.
export const peekAsideWidthAtom = atomWithWebStorage<number>(
  "relationPeekAsideWidth",
  typeof window !== "undefined" ? Math.round(window.innerWidth / 2) : 640,
);
