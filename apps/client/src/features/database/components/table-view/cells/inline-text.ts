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
//
// display:block + width:100% make the element fill the cell so an EMPTY value
// still has a full-width click target. In the table the fixed-width <td> hid
// this gap, but the row detail panel's flex/overflow column collapses an empty
// inline <Text> to zero width, leaving nothing to click (issue #93).
export const inlineDisplayStyle = {
  cursor: "text",
  display: "block",
  width: "100%",
  minHeight: INLINE_ROW_HEIGHT,
  lineHeight: `${INLINE_ROW_HEIGHT}px`,
} as const;

// Placeholder text shown in an empty inline cell. Kept dimmed so it reads as a
// hint, not a value, and gives the otherwise-blank box a visible click target.
export const INLINE_EMPTY_PLACEHOLDER = "Empty";
