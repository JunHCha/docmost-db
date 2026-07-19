import { Text } from "@mantine/core";
import dayjs from "dayjs";
import { CellProps } from "./cell-props";

// Read-only renderer for the created_time / last_edited_time computed columns.
// The server synthesizes the value from page metadata (a Date/ISO string); we
// just format it. There is no editor — computed columns cannot be edited.
export function TimestampCell({ value }: CellProps) {
  const raw = value?.value;
  const d = raw ? dayjs(raw as string | Date) : null;
  return (
    <Text size="sm" c={d ? undefined : "dimmed"}>
      {d && d.isValid() ? d.format("YYYY-MM-DD HH:mm") : ""}
    </Text>
  );
}

export default TimestampCell;
