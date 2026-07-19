import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { MemoryRouter } from "react-router-dom";
import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";

const navigate = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => navigate };
});

const setMutate = vi.fn();
const clearMutate = vi.fn();
const createRowMutate = vi.fn();

vi.mock("@/features/database/queries/database-query.ts", () => ({
  useSetValueMutation: () => ({ mutate: setMutate }),
  useClearValueMutation: () => ({ mutate: clearMutate }),
  useCreateRowMutation: () => ({ mutate: createRowMutate }),
}));

const patchRowValue = vi.fn();
const removeRowValue = vi.fn();
vi.mock("@/features/database/queries/database-cache.ts", () => ({
  patchRowValue: (...args: unknown[]) => patchRowValue(...args),
  removeRowValue: (...args: unknown[]) => removeRowValue(...args),
}));

// Capture each column drop target's onDrop so tests can simulate a card drop
// (pragmatic-drag-and-drop does not run in jsdom).
const dropHandlers: Array<(arg: { source: { data: any } }) => void> = [];
vi.mock(
  "@atlaskit/pragmatic-drag-and-drop/element/adapter",
  () => ({
    draggable: () => () => {},
    dropTargetForElements: (cfg: any) => {
      dropHandlers.push(cfg.onDrop);
      return () => {};
    },
  }),
);

import { BoardView } from "./board-view";
import {
  IDatabaseProperty,
  IDatabaseRow,
  IDatabaseView,
} from "@/features/database/types/database.types.ts";

const status: IDatabaseProperty = {
  id: "status",
  databaseId: "db1",
  name: "Status",
  type: "select",
  config: {
    options: [
      { id: "todo", label: "To do", color: "blue" },
      { id: "done", label: "Done", color: "green" },
    ],
  },
  position: "a0",
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
};

const properties: IDatabaseProperty[] = [status];

function rowWith(id: string, optionId?: string): IDatabaseRow {
  return {
    row: { id, title: id, slugId: id } as any,
    values: optionId
      ? [
          {
            id: `v-${id}`,
            pageId: id,
            propertyId: "status",
            value: { type: "select", value: optionId } as any,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]
      : [],
  };
}

function view(config: IDatabaseView["config"]): IDatabaseView {
  return {
    id: "v1",
    databaseId: "db1",
    name: "Board",
    type: "board",
    config,
    embedId: null,
    ownerUserId: null,
    isDefault: true,
    position: "a0",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function renderBoard(opts: {
  config?: IDatabaseView["config"];
  rows?: IDatabaseRow[];
  properties?: IDatabaseProperty[];
} = {}) {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MantineProvider>
        <MemoryRouter>
          <BoardView
            databaseId="db1"
            properties={opts.properties ?? properties}
            rows={opts.rows ?? []}
            activeView={view(opts.config ?? {})}
            spaceSlug="my-space"
          />
        </MemoryRouter>
      </MantineProvider>
    </QueryClientProvider>,
  );
}

describe("BoardView", () => {
  beforeEach(() => {
    dropHandlers.length = 0;
    setMutate.mockReset();
    clearMutate.mockReset();
    createRowMutate.mockReset();
    patchRowValue.mockReset();
    removeRowValue.mockReset();
    navigate.mockReset();
  });

  it("shows an empty state when no group-by property is set", () => {
    renderBoard();
    expect(screen.getByText("Select a property to group by")).toBeTruthy();
    expect(screen.queryByTestId("board-column")).toBeNull();
  });

  it("renders a column per option plus an unassigned column", () => {
    renderBoard({ config: { groupByPropertyId: "status" } });
    const columns = screen.getAllByTestId("board-column");
    // todo, done, and "No Status"
    expect(columns).toHaveLength(3);
    expect(screen.getByText("To do")).toBeTruthy();
    expect(screen.getByText("Done")).toBeTruthy();
    expect(screen.getByText("No Status")).toBeTruthy();
  });

  it("renders cards in their option column with a count", () => {
    renderBoard({
      config: { groupByPropertyId: "status" },
      rows: [rowWith("r1", "todo"), rowWith("r2", "todo"), rowWith("r3")],
    });
    const todo = screen
      .getAllByTestId("board-column")
      .find((c) => c.getAttribute("data-option-id") === "todo") as HTMLElement;
    expect(within(todo).getByTestId("board-column-count").textContent).toBe("2");
    expect(within(todo).getAllByTestId("board-card")).toHaveLength(2);
  });

  it("creates a row in the dropped option when + New is clicked", () => {
    renderBoard({ config: { groupByPropertyId: "status" } });
    const todo = screen
      .getAllByTestId("board-column")
      .find((c) => c.getAttribute("data-option-id") === "todo") as HTMLElement;
    fireEvent.click(within(todo).getByText("+ New"));
    expect(createRowMutate).toHaveBeenCalledWith(
      { databaseId: "db1", initialValues: {} },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it("seeds new cards with filter values but excludes the group-by property", () => {
    const tags: IDatabaseProperty = {
      id: "tags",
      databaseId: "db1",
      name: "Tags",
      type: "multi_select",
      config: { options: [{ id: "urgent", label: "Urgent", color: "red" }] },
      position: "a1",
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };
    renderBoard({
      properties: [status, tags],
      config: {
        groupByPropertyId: "status",
        filters: [
          { propertyId: "status", op: "eq", value: "done" },
          { propertyId: "tags", op: "contains", value: "urgent" },
        ],
      },
    });
    const todo = screen
      .getAllByTestId("board-column")
      .find((c) => c.getAttribute("data-option-id") === "todo") as HTMLElement;
    fireEvent.click(within(todo).getByText("+ New"));
    expect(createRowMutate).toHaveBeenCalledWith(
      {
        databaseId: "db1",
        initialValues: { tags: { type: "multi_select", value: ["urgent"] } },
      },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it("optimistically patches and sets the group value for a new card", () => {
    renderBoard({ config: { groupByPropertyId: "status" } });
    const todo = screen
      .getAllByTestId("board-column")
      .find((c) => c.getAttribute("data-option-id") === "todo") as HTMLElement;
    fireEvent.click(within(todo).getByText("+ New"));
    // Simulate the server resolving the new row, then drive onSuccess.
    const onSuccess = createRowMutate.mock.calls[0][1].onSuccess;
    onSuccess({ id: "newRow" });
    expect(patchRowValue).toHaveBeenCalled();
    expect(setMutate).toHaveBeenCalledWith({
      pageId: "newRow",
      propertyId: "status",
      value: { type: "select", value: "todo" },
    });
  });

  it("does not set or patch a group value for new cards in the unassigned column", () => {
    renderBoard({ config: { groupByPropertyId: "status" } });
    const unassigned = screen
      .getAllByTestId("board-column")
      .find(
        (c) => c.getAttribute("data-option-id") === "unassigned",
      ) as HTMLElement;
    fireEvent.click(within(unassigned).getByText("+ New"));
    const onSuccess = createRowMutate.mock.calls[0][1].onSuccess;
    onSuccess({ id: "newRow" });
    expect(setMutate).not.toHaveBeenCalled();
    expect(patchRowValue).not.toHaveBeenCalled();
  });

  it("sets the group value and optimistically patches on a card drop", () => {
    renderBoard({
      config: { groupByPropertyId: "status" },
      rows: [rowWith("r1", "todo")],
    });
    // Columns register drop targets in render order: todo, done, unassigned.
    const dropOnDone = dropHandlers[1];
    dropOnDone({ source: { data: { id: "r1" } } });
    expect(setMutate).toHaveBeenCalledWith({
      pageId: "r1",
      propertyId: "status",
      value: { type: "select", value: "done" },
    });
    expect(patchRowValue).toHaveBeenCalled();
    expect(clearMutate).not.toHaveBeenCalled();
  });

  it("clears the group value when a card is dropped on the unassigned column", () => {
    renderBoard({
      config: { groupByPropertyId: "status" },
      rows: [rowWith("r1", "todo")],
    });
    const dropOnUnassigned = dropHandlers[2];
    dropOnUnassigned({ source: { data: { id: "r1" } } });
    expect(clearMutate).toHaveBeenCalledWith({
      pageId: "r1",
      propertyId: "status",
    });
    expect(removeRowValue).toHaveBeenCalled();
    expect(setMutate).not.toHaveBeenCalled();
  });

  it("falls back to the empty state when group-by points at a non-groupable type", () => {
    const textProp: IDatabaseProperty = {
      id: "notes",
      databaseId: "db1",
      name: "Notes",
      type: "text",
      config: {},
      position: "a1",
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };
    renderBoard({
      config: { groupByPropertyId: "notes" },
      properties: [textProp],
    });
    expect(screen.getByText("Select a property to group by")).toBeTruthy();
    expect(screen.queryByTestId("board-column")).toBeNull();
  });

  it("renders visible non-group-by columns on each card", () => {
    const owner: IDatabaseProperty = {
      id: "owner",
      databaseId: "db1",
      name: "Owner",
      type: "text",
      config: {},
      position: "a1",
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };
    const ownerValue = {
      id: "ov-r1",
      pageId: "r1",
      propertyId: "owner",
      value: { type: "text", value: "Ann" } as any,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const row: IDatabaseRow = {
      row: { id: "r1", title: "r1", slugId: "r1" } as any,
      values: [
        {
          id: "v-r1",
          pageId: "r1",
          propertyId: "status",
          value: { type: "select", value: "todo" } as any,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        ownerValue,
      ],
    };
    renderBoard({
      config: { groupByPropertyId: "status" },
      properties: [status, owner],
      rows: [row],
    });
    // The group-by property (Status) is excluded; Owner's cell value shows.
    expect(screen.getByText("Ann")).toBeTruthy();
  });

  it("renders text fields compactly without a name label (#3 follow-up)", () => {
    const owner: IDatabaseProperty = {
      id: "owner",
      databaseId: "db1",
      name: "Owner",
      type: "text",
      config: {},
      position: "a1",
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };
    const row: IDatabaseRow = {
      row: { id: "r1", title: "r1", slugId: "r1" } as any,
      values: [
        {
          id: "v-r1",
          pageId: "r1",
          propertyId: "status",
          value: { type: "select", value: "todo" } as any,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "ov-r1",
          pageId: "r1",
          propertyId: "owner",
          value: { type: "text", value: "Ann" } as any,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    };
    renderBoard({
      config: { groupByPropertyId: "status" },
      properties: [status, owner],
      rows: [row],
    });
    const card = screen.getByTestId("board-card");
    // The value shows, but the column name is not repeated on the card.
    expect(within(card).getByText("Ann")).toBeTruthy();
    expect(within(card).queryByText("Owner")).toBeNull();
  });

  it("labels a checkbox field with its property name (boolean notation)", () => {
    const done: IDatabaseProperty = {
      id: "done",
      databaseId: "db1",
      name: "Done",
      type: "checkbox",
      config: {},
      position: "a1",
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };
    const row: IDatabaseRow = {
      row: { id: "r1", title: "r1", slugId: "r1" } as any,
      values: [
        {
          id: "v-r1",
          pageId: "r1",
          propertyId: "status",
          value: { type: "select", value: "todo" } as any,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "dv-r1",
          pageId: "r1",
          propertyId: "done",
          value: { type: "checkbox", value: true } as any,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    };
    renderBoard({
      config: { groupByPropertyId: "status" },
      properties: [status, done],
      rows: [row],
    });
    const card = screen.getByTestId("board-card");
    // A lone checkbox is meaningless, so the card names it and shows the toggle.
    expect(within(card).getByText("Done")).toBeTruthy();
    expect(within(card).getByLabelText("Done")).toBeTruthy();
  });

  it("hides columns flagged visible:false from cards", () => {
    const owner: IDatabaseProperty = {
      id: "owner",
      databaseId: "db1",
      name: "Owner",
      type: "text",
      config: {},
      position: "a1",
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };
    const row: IDatabaseRow = {
      row: { id: "r1", title: "r1", slugId: "r1" } as any,
      values: [
        {
          id: "v-r1",
          pageId: "r1",
          propertyId: "status",
          value: { type: "select", value: "todo" } as any,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "ov-r1",
          pageId: "r1",
          propertyId: "owner",
          value: { type: "text", value: "Ann" } as any,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    };
    renderBoard({
      config: {
        groupByPropertyId: "status",
        columns: [{ propertyId: "owner", visible: false }],
      },
      properties: [status, owner],
      rows: [row],
    });
    expect(screen.queryByText("Ann")).toBeNull();
  });
});
