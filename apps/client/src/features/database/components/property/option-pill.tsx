import {
  OPTION_TEXT_COLOR,
  resolveOptionColor,
} from "./option-colors.ts";

interface OptionPillProps {
  color: string | undefined;
  label: string;
}

// Notion-style rounded pill for a select / multi_select option. The label text
// is rendered verbatim so cells and the options editor can query it by text.
export function OptionPill({ color, label }: OptionPillProps) {
  const resolved = resolveOptionColor(color);
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        background: resolved.bg,
        color: OPTION_TEXT_COLOR,
        borderRadius: 4,
        padding: "1px 8px",
        fontSize: 12,
        lineHeight: "18px",
        maxWidth: "100%",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

export default OptionPill;
