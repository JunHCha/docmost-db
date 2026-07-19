import {
  IconArrowsLeftRight,
  IconCalendar,
  IconCalendarPlus,
  IconCircleDot,
  IconClockEdit,
  IconHash,
  IconLetterCase,
  IconLink,
  IconList,
  IconSquareCheck,
  IconUser,
  IconUserCircle,
  type IconProps,
} from "@tabler/icons-react";
import { ComponentType } from "react";
import { PropertyType } from "@/features/database/types/database.types.ts";

// Single source of truth mapping each property data type to its icon, so the
// table column header, the page row-properties panel and the database template
// editor all show the same glyph for a given type (#104).
export const PROPERTY_TYPE_ICONS: Record<
  PropertyType,
  ComponentType<IconProps>
> = {
  text: IconLetterCase,
  number: IconHash,
  date: IconCalendar,
  select: IconCircleDot,
  multi_select: IconList,
  checkbox: IconSquareCheck,
  url: IconLink,
  relation: IconArrowsLeftRight,
  person: IconUser,
  created_by: IconUserCircle,
  created_time: IconCalendarPlus,
  last_edited_time: IconClockEdit,
};

interface PropertyTypeIconProps {
  type: PropertyType;
  size?: number;
  className?: string;
}

// Decorative by default: the type's name/label always sits next to it (column
// name, property label), so the icon is hidden from assistive tech to avoid
// duplicate announcements. Color/stroke match the surrounding dimmed chrome.
export function PropertyTypeIcon({
  type,
  size = 14,
  className,
}: PropertyTypeIconProps) {
  const Icon = PROPERTY_TYPE_ICONS[type];
  if (!Icon) return null;
  return (
    <Icon
      size={size}
      stroke={1.8}
      color="var(--mantine-color-dimmed)"
      className={className}
      aria-hidden
      style={{ flexShrink: 0 }}
    />
  );
}

export default PropertyTypeIcon;
