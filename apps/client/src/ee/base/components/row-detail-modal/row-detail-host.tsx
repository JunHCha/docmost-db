import { Tooltip } from "@mantine/core";
import {
  IconArrowsMaximize,
  IconLayoutSidebarRight,
} from "@tabler/icons-react";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { RowDetailCommonProps } from "./row-detail-body";
import { RowDetailModal } from "./row-detail-modal";
import { RowDetailPanel } from "./row-detail-panel";
import classes from "@/ee/base/styles/row-detail-modal.module.css";

const MODE_STORAGE_KEY = "docmost:base-row-detail-mode";

type RowDetailMode = "panel" | "modal";

function readStoredMode(): RowDetailMode {
  try {
    return localStorage.getItem(MODE_STORAGE_KEY) === "modal"
      ? "modal"
      : "panel";
  } catch {
    return "panel";
  }
}

/** Fork: decides how an expanded row is displayed — side panel (default) or
 *  the upstream modal — and injects a top-bar toggle to flip between the two
 *  in place. The choice persists per browser via localStorage. */
export function RowDetailHost(props: RowDetailCommonProps) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<RowDetailMode>(readStoredMode);

  const toggleMode = useCallback(() => {
    setMode((prev) => {
      const next: RowDetailMode = prev === "panel" ? "modal" : "panel";
      try {
        localStorage.setItem(MODE_STORAGE_KEY, next);
      } catch {
        // Storage unavailable (e.g. private mode): the toggle still applies
        // for this session.
      }
      return next;
    });
  }, []);

  const label =
    mode === "panel" ? t("Open as modal") : t("Open as side panel");
  const modeToggle = (
    <Tooltip label={label} openDelay={400}>
      <button
        type="button"
        className={classes.iconButton}
        onClick={toggleMode}
        aria-label={label}
      >
        {mode === "panel" ? (
          <IconArrowsMaximize size={16} />
        ) : (
          <IconLayoutSidebarRight size={16} />
        )}
      </button>
    </Tooltip>
  );

  if (mode === "modal") {
    return <RowDetailModal {...props} topBarExtra={modeToggle} />;
  }
  return <RowDetailPanel {...props} topBarExtra={modeToggle} />;
}
