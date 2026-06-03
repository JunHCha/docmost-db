// Shared sizing for inline cell editing. The display element (Text/Anchor) and
// the edit <TextInput> must occupy the exact same box so switching to edit mode
// only shows a caret — no row line-height jump. Mantine's input has a size-based
// min-height (~30px for "xs") that is taller than the ~20px text row, which was
// the cause of the height change; we pin the input box to the text's metrics.

export const INLINE_ROW_HEIGHT = 20;

// Spread onto the editing <TextInput variant="unstyled" />.
export const inlineInputStyles = {
  input: {
    height: INLINE_ROW_HEIGHT,
    minHeight: INLINE_ROW_HEIGHT,
    lineHeight: `${INLINE_ROW_HEIGHT}px`,
    padding: 0,
    fontSize: "var(--mantine-font-size-sm)",
  },
} as const;

// Spread onto the display <Text size="sm" /> (or Anchor wrapper).
export const inlineDisplayStyle = {
  cursor: "text",
  minHeight: INLINE_ROW_HEIGHT,
  lineHeight: `${INLINE_ROW_HEIGHT}px`,
} as const;
