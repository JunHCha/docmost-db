import { Box, Group, ScrollArea } from "@mantine/core";
import { IconGripVertical } from "@tabler/icons-react";
import { useAtom, useAtomValue } from "jotai";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  pagePeekAtom,
  peekAsideWidthAtom,
} from "@/features/database/atoms/page-peek-atom.ts";
import { usePagePeek } from "./use-page-peek.tsx";
import { PeekHostControls } from "./peek-host-controls.tsx";
import { RelationPagePeek } from "./relation-page-peek.tsx";
import classes from "./relation-peek-aside-panel.module.css";

// Height of the app header; the overlay starts below it.
const HEADER_HEIGHT = 45;

// The aside host for the relation page peek (#94): a right-side overlay that
// floats over the page (covering ~half the screen by default) instead of an
// AppShell column that pushes the content aside — so the database table stays
// visible underneath. Width is drag-resizable from the left-edge grip.
export function RelationPeekAsidePanel() {
  const { t } = useTranslation();
  const { pageId, host } = useAtomValue(pagePeekAtom);
  const { close } = usePagePeek();
  const [width, setWidth] = useAtom(peekAsideWidthAtom);
  const [resizing, setResizing] = useState(false);

  const onMove = useCallback(
    (e: MouseEvent) => {
      const next = window.innerWidth - e.clientX;
      // Keep a slice of the page visible on the left; never below a usable min.
      setWidth(
        Math.min(Math.round(window.innerWidth * 0.85), Math.max(360, next)),
      );
    },
    [setWidth],
  );

  useEffect(() => {
    if (!resizing) return;
    const stop = () => setResizing(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", stop);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", stop);
    };
  }, [resizing, onMove]);

  if (host !== "aside" || !pageId) return null;

  return (
    <>
      {/* Transparent click-catcher: clicking the page behind the overlay closes
          the peek (#94). No dim — the table stays visible underneath. */}
      <div
        className={classes.backdrop}
        style={{ top: HEADER_HEIGHT }}
        onClick={close}
        aria-hidden
      />
      <Box
        className={classes.panel}
        style={{ width, top: HEADER_HEIGHT }}
        role="complementary"
        aria-label={t("Preview")}
      >
      <div
        className={classes.grip}
        onMouseDown={(e) => {
          e.preventDefault();
          setResizing(true);
        }}
        role="separator"
        aria-orientation="vertical"
        aria-label={t("Resize panel")}
      >
        <IconGripVertical size={14} stroke={1.5} />
      </div>
      <Group justify="flex-end" px="xs" py={6} className={classes.header}>
        <PeekHostControls />
      </Group>
        <ScrollArea className={classes.body} scrollbarSize={5} type="scroll">
          <RelationPagePeek pageId={pageId} />
        </ScrollArea>
      </Box>
    </>
  );
}

export default RelationPeekAsidePanel;
