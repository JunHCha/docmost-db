import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import {
  DatabaseCollabContext,
  DatabaseCollabContextValue,
} from "../hooks/database-collab-context";
import { DatabaseCollabUser } from "../hooks/use-database-collab";
import { DatabasePresenceAvatars } from "./database-presence-avatars";

function renderWithUsers(onlineUsers: DatabaseCollabUser[]) {
  const value: DatabaseCollabContextValue = {
    broadcastChange: () => {},
    onlineUsers,
    editingByCell: {},
    setEditingCell: () => {},
  };
  return render(
    <MantineProvider>
      <DatabaseCollabContext.Provider value={value}>
        <DatabasePresenceAvatars />
      </DatabaseCollabContext.Provider>
    </MantineProvider>,
  );
}

const user = (id: string, name: string): DatabaseCollabUser => ({
  id,
  name,
  avatarUrl: `${id}.png`,
});

describe("DatabasePresenceAvatars", () => {
  it("renders nothing when no one else is connected", () => {
    const { container } = renderWithUsers([]);
    expect(container.querySelector('[aria-label="Connected users"]')).toBeNull();
  });

  it("renders one avatar per connected user", () => {
    const { container } = renderWithUsers([
      user("u1", "Ada Lovelace"),
      user("u2", "Bob"),
    ]);
    expect(container.querySelectorAll(".mantine-Avatar-root")).toHaveLength(2);
  });

  it("dedupes the same user connected from multiple tabs", () => {
    const { container } = renderWithUsers([user("u1", "Ada"), user("u1", "Ada")]);
    expect(container.querySelectorAll(".mantine-Avatar-root")).toHaveLength(1);
  });

  it("collapses extra users into a +N overflow chip", () => {
    renderWithUsers([
      user("u1", "Aa"),
      user("u2", "Bb"),
      user("u3", "Cc"),
      user("u4", "Dd"),
      user("u5", "Ee"),
    ]);
    // MAX_VISIBLE = 3, so two remain -> "+2".
    expect(screen.getByText("+2")).toBeTruthy();
  });
});
