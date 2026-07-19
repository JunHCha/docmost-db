import { describe, it, expect, vi } from "vitest";

// Cells import the query hooks, whose module chain executes main.tsx
// (ReactDOM.createRoot) at load. Mock the hooks so the registry can be tested
// without booting the app shell.
vi.mock("@/features/database/queries/database-query.ts", () => ({
  useSetValueMutation: () => ({ mutate: vi.fn() }),
  useClearValueMutation: () => ({ mutate: vi.fn() }),
  useUpdatePropertyMutation: () => ({ mutate: vi.fn() }),
  useDatabaseRowsQuery: () => ({ data: [] }),
}));

vi.mock("@/features/workspace/queries/workspace-query.ts", () => ({
  useWorkspaceMembersQuery: () => ({ data: { items: [] } }),
}));

import { getCellComponent } from "./registry";
import { TextCell } from "./text-cell";
import { NumberCell } from "./number-cell";
import { CheckboxCell } from "./checkbox-cell";
import { UrlCell } from "./url-cell";
import { DateCell } from "./date-cell";
import { SelectCell } from "./select-cell";
import { MultiSelectCell } from "./multi-select-cell";
import { RelationCell } from "./relation-cell";
import { CreatedByCell } from "./created-by-cell";
import { TimestampCell } from "./timestamp-cell";

describe("cell registry", () => {
  it("returns the registered component for known types", () => {
    expect(getCellComponent("text")).toBe(TextCell);
    expect(getCellComponent("number")).toBe(NumberCell);
    expect(getCellComponent("checkbox")).toBe(CheckboxCell);
    expect(getCellComponent("url")).toBe(UrlCell);
    expect(getCellComponent("date")).toBe(DateCell);
    expect(getCellComponent("select")).toBe(SelectCell);
    expect(getCellComponent("multi_select")).toBe(MultiSelectCell);
    expect(getCellComponent("relation")).toBe(RelationCell);
  });

  it("maps computed system columns to read-only renderers", () => {
    expect(getCellComponent("created_by")).toBe(CreatedByCell);
    expect(getCellComponent("created_time")).toBe(TimestampCell);
    expect(getCellComponent("last_edited_time")).toBe(TimestampCell);
  });
});
