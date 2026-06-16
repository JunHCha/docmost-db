import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";

const setMutate = vi.fn();
const clearMutate = vi.fn();

vi.mock("@/features/database/queries/database-query.ts", () => ({
  useSetValueMutation: () => ({ mutate: setMutate }),
  useClearValueMutation: () => ({ mutate: clearMutate }),
}));

import { UrlCell } from "./url-cell";
import { IDatabaseProperty } from "@/features/database/types/database.types.ts";

const property: IDatabaseProperty = {
  id: "prop1",
  databaseId: "db1",
  name: "Link",
  type: "url",
  config: {},
  position: "a0",
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
};

function renderCell(value: any) {
  return render(
    <MantineProvider>
      <UrlCell
        property={property}
        value={value}
        pageId="page1"
        databaseId="db1"
      />
    </MantineProvider>,
  );
}

describe("UrlCell", () => {
  beforeEach(() => {
    setMutate.mockReset();
    clearMutate.mockReset();
  });

  it("renders a real navigable link (href + new tab) for a stored url", () => {
    renderCell({ type: "url", value: "https://example.com" });
    const link = screen.getByRole("link", { name: "https://example.com" });
    expect(link.getAttribute("href")).toBe("https://example.com");
    expect(link.getAttribute("target")).toBe("_blank");
  });

  it("normalizes a scheme-less url to https so it does NOT resolve as a sub-route of the current site", () => {
    renderCell({ type: "url", value: "google.com" });
    // Display text stays exactly what the user typed...
    const link = screen.getByRole("link", { name: "google.com" });
    // ...but the href is absolute, so the browser leaves the app instead of
    // navigating to <current-site>/google.com.
    expect(link.getAttribute("href")).toBe("https://google.com");
  });

  it("leaves an explicit scheme untouched (http, mailto, host:port)", () => {
    renderCell({ type: "url", value: "http://insecure.test" });
    expect(
      screen.getByRole("link", { name: "http://insecure.test" }).getAttribute("href"),
    ).toBe("http://insecure.test");

    renderCell({ type: "url", value: "mailto:a@b.com" });
    expect(
      screen.getByRole("link", { name: "mailto:a@b.com" }).getAttribute("href"),
    ).toBe("mailto:a@b.com");

    // A bare host:port has no scheme, so it must still get https:// (not be
    // mistaken for a "host:" scheme).
    renderCell({ type: "url", value: "localhost:3000" });
    expect(
      screen.getByRole("link", { name: "localhost:3000" }).getAttribute("href"),
    ).toBe("https://localhost:3000");
  });

  it("does not swallow the link click into edit mode (navigation is preserved)", () => {
    renderCell({ type: "url", value: "https://example.com" });
    const link = screen.getByRole("link", { name: "https://example.com" });
    // A plain left-click must NOT call preventDefault — the browser follows the
    // href. The cell must stay in display mode (no edit input appears).
    const event = new MouseEvent("click", { bubbles: true, cancelable: true });
    link.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    expect(screen.queryByLabelText("Link")).toBeNull();
  });

  it("enters edit mode via the edit affordance and commits a new url", () => {
    renderCell({ type: "url", value: "https://old.com" });
    fireEvent.click(screen.getByLabelText("Edit Link"));
    const input = screen.getByLabelText("Link");
    fireEvent.change(input, { target: { value: "https://new.com" } });
    fireEvent.blur(input);
    expect(setMutate).toHaveBeenCalledWith({
      pageId: "page1",
      propertyId: "prop1",
      value: { type: "url", value: "https://new.com" },
    });
  });

  it("starts editing when an empty cell is clicked", () => {
    renderCell(undefined);
    fireEvent.click(screen.getByLabelText("Edit Link"));
    const input = screen.getByLabelText("Link");
    fireEvent.change(input, { target: { value: "https://x.com" } });
    fireEvent.blur(input);
    expect(setMutate).toHaveBeenCalledWith({
      pageId: "page1",
      propertyId: "prop1",
      value: { type: "url", value: "https://x.com" },
    });
  });
});
