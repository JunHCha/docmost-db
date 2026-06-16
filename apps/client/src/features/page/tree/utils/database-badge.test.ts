import { describe, it, expect } from "vitest";
import { shouldShowDatabaseBadge } from "./utils.ts";

describe("shouldShowDatabaseBadge", () => {
  it("shows the badge when a database has a custom icon", () => {
    // The custom icon replaces the default IconDatabase, so the badge is the
    // only remaining cue that the row is a database (issue #7).
    expect(shouldShowDatabaseBadge({ pageType: "database", icon: "📊" })).toBe(
      true,
    );
  });

  it("does not show the badge for a database without a custom icon", () => {
    // The default IconDatabase already identifies the type, so no extra badge.
    expect(shouldShowDatabaseBadge({ pageType: "database", icon: null })).toBe(
      false,
    );
    expect(shouldShowDatabaseBadge({ pageType: "database", icon: "" })).toBe(
      false,
    );
    expect(shouldShowDatabaseBadge({ pageType: "database" })).toBe(false);
  });

  it("never shows the badge for a regular page", () => {
    expect(shouldShowDatabaseBadge({ pageType: "page", icon: "📄" })).toBe(
      false,
    );
    expect(shouldShowDatabaseBadge({ icon: "📄" })).toBe(false);
  });
});
