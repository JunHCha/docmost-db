import { Avatar, Tooltip } from "@mantine/core";
import { CustomAvatar } from "@/components/ui/custom-avatar.tsx";
import { useDatabaseCollabPresence } from "../hooks/database-collab-context";

const MAX_VISIBLE = 3;

/**
 * Presence avatar stack for the database view header (#55 Phase 4). Shows the
 * other users currently connected to the same DB view (from Yjs awareness).
 * Renders nothing when no one else is here, so single-user views stay clean.
 */
export function DatabasePresenceAvatars() {
  const { onlineUsers } = useDatabaseCollabPresence();
  // Distinct users — the same person may have several tabs/clients open.
  const users = Array.from(
    new Map(onlineUsers.map((u) => [u.id, u])).values(),
  );
  if (users.length === 0) return null;

  const visible = users.slice(0, MAX_VISIBLE);
  const overflow = users.length - visible.length;

  return (
    <Avatar.Group spacing="sm" aria-label="Connected users">
      {visible.map((user) => (
        <Tooltip key={user.id} label={user.name} withArrow>
          <CustomAvatar
            avatarUrl={user.avatarUrl}
            name={user.name}
            size="sm"
            radius="xl"
          />
        </Tooltip>
      ))}
      {overflow > 0 && (
        <Tooltip
          label={users
            .slice(MAX_VISIBLE)
            .map((u) => u.name)
            .join(", ")}
          withArrow
        >
          <Avatar size="sm" radius="xl">
            {`+${overflow}`}
          </Avatar>
        </Tooltip>
      )}
    </Avatar.Group>
  );
}

export default DatabasePresenceAvatars;
