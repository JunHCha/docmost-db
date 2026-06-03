import { Checkbox } from "@mantine/core";
import {
  useClearValueMutation,
  useSetValueMutation,
} from "@/features/database/queries/database-query.ts";
import { CellProps } from "./cell-props";

export function CheckboxCell({
  property,
  value,
  pageId,
  databaseId,
}: CellProps) {
  const setValue = useSetValueMutation(databaseId);
  const clearValue = useClearValueMutation(databaseId);
  const checked = value?.value === true;

  function toggle(next: boolean) {
    if (next) {
      setValue.mutate({
        pageId,
        propertyId: property.id,
        value: { type: "checkbox", value: true },
      });
    } else {
      clearValue.mutate({ pageId, propertyId: property.id });
    }
  }

  return (
    <Checkbox
      checked={checked}
      aria-label={property.name}
      onChange={(e) => toggle(e.currentTarget.checked)}
    />
  );
}

export default CheckboxCell;
