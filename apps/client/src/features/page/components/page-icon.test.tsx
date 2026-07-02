import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const mutateAsync = vi.fn();
const emit = vi.fn();

vi.mock("@/features/page/queries/page-query.ts", () => ({
  useUpdatePageMutation: () => ({ mutateAsync }),
}));
vi.mock("@/features/websocket/use-query-emit.ts", () => ({
  useQueryEmit: () => emit,
}));
// The real picker lazy-loads emoji-mart; stub it so the icon node and the
// select/remove callbacks are directly exercisable.
vi.mock("@/components/ui/emoji-picker.tsx", () => ({
  default: ({ onEmojiSelect, removeEmojiAction, icon, readOnly }: any) => (
    <div>
      <div data-testid="icon">{icon}</div>
      <button onClick={() => onEmojiSelect({ native: "🔥" })}>select</button>
      <button onClick={() => removeEmojiAction()}>remove</button>
      <span data-testid="readonly">{String(readOnly)}</span>
    </div>
  ),
}));

import { PageIcon } from "./page-icon";

function renderIcon(props: Partial<Parameters<typeof PageIcon>[0]> = {}) {
  return render(
    <PageIcon
      pageId="p1"
      spaceId="s1"
      icon={null}
      pageType="doc"
      editable
      {...props}
    />,
  );
}

describe("PageIcon", () => {
  beforeEach(() => {
    mutateAsync.mockReset().mockResolvedValue({ parentPageId: null });
    emit.mockReset();
  });

  it("renders the document default icon for a doc page with no emoji", () => {
    const { container } = renderIcon({ pageType: "doc", icon: null });
    expect(container.querySelector(".tabler-icon-file-description")).toBeTruthy();
    expect(container.querySelector(".tabler-icon-database")).toBeNull();
  });

  it("renders the database default icon for a database page with no emoji", () => {
    const { container } = renderIcon({ pageType: "database", icon: null });
    expect(container.querySelector(".tabler-icon-database")).toBeTruthy();
  });

  it("renders the emoji when one is set", () => {
    renderIcon({ icon: "😀" });
    expect(screen.getByTestId("icon").textContent).toContain("😀");
  });

  it("persists the picked emoji via the update mutation", async () => {
    renderIcon({ icon: null });
    fireEvent.click(screen.getByText("select"));
    expect(mutateAsync).toHaveBeenCalledWith({ pageId: "p1", icon: "🔥" });
    await waitFor(() => expect(emit).toHaveBeenCalled());
    expect(emit.mock.calls[0][0]).toMatchObject({
      operation: "updateOne",
      id: "p1",
      payload: { icon: "🔥" },
    });
  });

  it("clears the icon on remove", () => {
    renderIcon({ icon: "😀" });
    fireEvent.click(screen.getByText("remove"));
    expect(mutateAsync).toHaveBeenCalledWith({ pageId: "p1", icon: null });
  });

  it("is read-only when not editable", () => {
    renderIcon({ editable: false });
    expect(screen.getByTestId("readonly").textContent).toBe("true");
  });
});
