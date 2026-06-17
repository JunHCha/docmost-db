import { useAtom } from "jotai";
import {
  pagePeekAtom,
  PeekHost,
} from "@/features/database/atoms/page-peek-atom.ts";

// Drives the relation page peek (#94): opening it (optionally in a specific
// host), switching the host, and closing it. Both hosts render off the single
// pagePeekAtom, so this only owns that atom — no global aside state.
//
// This module deliberately holds no import of the (heavy) peek body or page
// queries so cells can open the peek without eagerly pulling the page editor /
// page-query graph into every table-view test.
export function usePagePeek() {
  const [peek, setPeek] = useAtom(pagePeekAtom);

  // `host` omitted keeps the current host (used by the in-peek toggle); passing
  // one opens directly in that host (the chip's side-panel / modal icons).
  const open = (pageId: string, host?: PeekHost) =>
    setPeek((p) => ({ pageId, host: host ?? p.host }));
  const setHost = (host: PeekHost) => setPeek((p) => ({ ...p, host }));
  const close = () => setPeek((p) => ({ ...p, pageId: null }));

  return { ...peek, open, setHost, close };
}
