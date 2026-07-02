import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";

const setMutate = vi.fn();
const clearMutate = vi.fn();
let membersData: any[] = [];

vi.mock("@/features/database/queries/database-query.ts", () => ({
  useSetValueMutation: () => ({ mutate: setMutate }),
  useClearValueMutation: () => ({ mutate: clearMutate }),
}));

vi.mock("@/features/workspace/queries/workspace-query.ts", () => ({
  useWorkspaceMembersQuery: () => ({ data: { items: membersData } }),
}));

import { PersonCell } from "./person-cell";
import { IDatabaseProperty } from "@/features/database/types/database.types.ts";

const property: IDatabaseProperty = {
  id: "p1",
  databaseId: "db1",
  name: "Assignee",
  type: "person",
  config: {},
  position: "a0",
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
};

function user(id: string, name: string, email = `${id}@x.io`) {
  return { id, name, email, avatarUrl: "" };
}

function renderCell(value: any, showEmptyPlaceholder = false) {
  return render(
    <MantineProvider>
      <PersonCell
        property={property}
        value={value}
        pageId="page1"
        databaseId="db1"
        showEmptyPlaceholder={showEmptyPlaceholder}
      />
    </MantineProvider>,
  );
}

describe("PersonCell", () => {
  beforeEach(() => {
    setMutate.mockReset();
    clearMutate.mockReset();
    membersData = [user("u1", "Alice"), user("u2", "Bob")];
  });

  function clickOption(label: string) {
    const option = screen
      .getAllByRole("option")
      .find((el) => el.textContent?.includes(label));
    fireEvent.click(option!);
  }

  it("renders a chip with the name for each selected user", () => {
    renderCell({ type: "person", value: ["u1", "u2"] });
    expect(screen.getByText("Alice")).toBeTruthy();
    expect(screen.getByText("Bob")).toBeTruthy();
  });

  it("shows an Unknown fallback for an unresolved id without crashing", () => {
    renderCell({ type: "person", value: ["u1", "gone"] });
    expect(screen.getByText("Alice")).toBeTruthy();
    expect(screen.getByText("Unknown")).toBeTruthy();
  });

  it("adds a user id to the array on selection", () => {
    renderCell({ type: "person", value: ["u1"] });
    fireEvent.click(screen.getByLabelText("Assignee"));
    clickOption("Bob");
    expect(setMutate).toHaveBeenCalledWith({
      pageId: "page1",
      propertyId: "p1",
      value: { type: "person", value: ["u1", "u2"] },
    });
  });

  it("removes a user id when toggled off, keeping the rest", () => {
    renderCell({ type: "person", value: ["u1", "u2"] });
    fireEvent.click(screen.getByLabelText("Assignee"));
    clickOption("Alice");
    expect(setMutate).toHaveBeenCalledWith({
      pageId: "page1",
      propertyId: "p1",
      value: { type: "person", value: ["u2"] },
    });
  });

  it("clears the value when the last person is removed", () => {
    renderCell({ type: "person", value: ["u1"] });
    fireEvent.click(screen.getByLabelText("Assignee"));
    clickOption("Alice");
    expect(clearMutate).toHaveBeenCalledWith({
      pageId: "page1",
      propertyId: "p1",
    });
    expect(setMutate).not.toHaveBeenCalled();
  });

  it("filters the member list by name or email", () => {
    renderCell({ type: "person", value: [] });
    fireEvent.click(screen.getByLabelText("Assignee"));
    const search = screen.getByPlaceholderText("Search...");
    fireEvent.change(search, { target: { value: "ali" } });
    const options = screen.getAllByRole("option");
    expect(options.some((o) => o.textContent?.includes("Alice"))).toBe(true);
    expect(options.some((o) => o.textContent?.includes("Bob"))).toBe(false);
  });

  it("shows a dimmed Empty placeholder only when requested", () => {
    renderCell({ type: "person", value: [] }, true);
    expect(screen.getByText("Empty")).toBeTruthy();
  });

  function renderControlled(value: any, onChange: (n: any) => void) {
    return render(
      <MantineProvider>
        <PersonCell
          property={property}
          value={value}
          pageId=""
          databaseId="db1"
          onChange={onChange}
        />
      </MantineProvider>,
    );
  }

  it("controlled: emits onChange(person array) on selection, no mutation", () => {
    const onChange = vi.fn();
    renderControlled({ type: "person", value: ["u1"] }, onChange);
    fireEvent.click(screen.getByLabelText("Assignee"));
    clickOption("Bob");
    expect(onChange).toHaveBeenCalledWith({
      type: "person",
      value: ["u1", "u2"],
    });
    expect(setMutate).not.toHaveBeenCalled();
  });

  it("controlled: emits onChange(undefined) when last person removed", () => {
    const onChange = vi.fn();
    renderControlled({ type: "person", value: ["u1"] }, onChange);
    fireEvent.click(screen.getByLabelText("Assignee"));
    clickOption("Alice");
    expect(onChange).toHaveBeenCalledWith(undefined);
    expect(clearMutate).not.toHaveBeenCalled();
  });
});
