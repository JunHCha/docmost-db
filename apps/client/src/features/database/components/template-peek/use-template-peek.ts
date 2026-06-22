import { useAtom } from "jotai";
import {
  templatePeekAtom,
  TemplatePeekHost,
} from "@/features/database/atoms/template-peek-atom.ts";

// Drives the database template editor peek (#102): opening it (in a chosen
// host), switching host (aside ↔ modal), and closing. The overlay hosts both
// render off this single atom.
//
// Holds no import of the (heavy) editor body so the toolbar menu can open the
// peek without pulling the tiptap graph into the database view.
export function useTemplatePeek() {
  const [peek, setPeek] = useAtom(templatePeekAtom);

  const open = (
    databaseId: string,
    templateId: string | null,
    host: TemplatePeekHost = "modal",
  ) => setPeek({ databaseId, templateId, host });

  const setHost = (host: TemplatePeekHost) =>
    setPeek((p) => ({ ...p, host }));

  const close = () =>
    setPeek((p) => ({ ...p, databaseId: null, templateId: null }));

  return { ...peek, open, setHost, close };
}
