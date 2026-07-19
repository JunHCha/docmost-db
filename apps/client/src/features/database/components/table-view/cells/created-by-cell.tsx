import { Group, Text } from "@mantine/core";
import { useWorkspaceMembersQuery } from "@/features/workspace/queries/workspace-query.ts";
import { IUser } from "@/features/user/types/user.types.ts";
import { CustomAvatar } from "@/components/ui/custom-avatar.tsx";
import { CellProps } from "./cell-props";

// Read-only renderer for the created_by computed column. The server synthesizes
// the value as the row page's creator userId; we resolve it against the
// workspace member list (same approach as PersonCell) and render an avatar +
// name. There is no editor — computed columns cannot be edited.
export function CreatedByCell({ value }: CellProps) {
  const { data: members } = useWorkspaceMembersQuery({ limit: 100 });
  const userId = typeof value?.value === "string" ? value.value : "";
  if (!userId) {
    return <Text size="sm" c="dimmed" />;
  }
  const users: IUser[] = members?.items ?? [];
  const user = users.find((u) => u.id === userId);
  return (
    <Group gap={4} wrap="nowrap">
      <CustomAvatar avatarUrl={user?.avatarUrl} name={user?.name ?? "?"} size={18} />
      <Text size="xs" lineClamp={1}>
        {user?.name ?? userId}
      </Text>
    </Group>
  );
}

export default CreatedByCell;
