import { Box, Group, ScrollArea } from "@mantine/core";
import { IconGripVertical } from "@tabler/icons-react";
import { useAtom } from "jotai";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { peekAsideWidthAtom } from "@/features/database/atoms/page-peek-atom.ts";
import { useTemplatePeek } from "./use-template-peek";
import { TemplatePeekBody } from "./template-peek-body";
import { TemplatePeekHostControls } from "./template-peek-host-controls";
import classes from "./template-peek-aside-panel.module.css";

// Height of the app header; the overlay starts below it.
const HEADER_HEIGHT = 45;

// The aside host for the template editor (#102): a drag-resizable right-side
// overlay that floats over the page so the database table stays visible.
// Shares the relation peek's persisted aside width.
export function TemplatePeekAsidePanel() {
  const { t } = useTranslation();
  const { databaseId, templateId, host, close } = useTemplatePeek();
  const [width, setWidth] = useAtom(peekAsideWidthAtom);
  const [resizing, setResizing] = useState(false);

  const onMove = useCallback(
    (e: MouseEvent) => {
      const next = window.innerWidth - e.clientX;
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

  if (host !== "aside" || !databaseId) return null;

  return (
    <>
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
        aria-label={t("Edit template")}
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
        <ScrollArea className={classes.body} scrollbarSize={5} type="scroll">
          <TemplatePeekBody
            databaseId={databaseId}
            templateId={templateId}
            onClose={close}
            headerControls={<TemplatePeekHostControls />}
          />
        </ScrollArea>
      </Box>
    </>
  );
}

export default TemplatePeekAsidePanel;
