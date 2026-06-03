import { describe, it, expect, vi } from "vitest";

// Cells import the query hooks, whose module chain executes main.tsx
// (ReactDOM.createRoot) at load. Mock the hooks so the registry can be tested
// without booting the app shell.
vi.mock("@/features/database/queries/database-query.ts", () => ({
  useSetValueMutation: () => ({ mutate: vi.fn() }),
  useClearValueMutation: () => ({ mutate: vi.fn() }),
}));

import { getCellComponent, FallbackCell } from "./registry";
import { TextCell } from "./text-cell";
import { NumberCell } from "./number-cell";
import { CheckboxCell } from "./checkbox-cell";
import { UrlCell } from "./url-cell";
import { DateCell } from "./date-cell";

describe("cell registry", () => {
  it("returns the registered component for known types", () => {
    expect(getCellComponent("text")).toBe(TextCell);
    expect(getCellComponent("number")).toBe(NumberCell);
    expect(getCellComponent("checkbox")).toBe(CheckboxCell);
    expect(getCellComponent("url")).toBe(UrlCell);
    expect(getCellComponent("date")).toBe(DateCell);
  });

  it("falls back for relation (lands in #10)", () => {
    expect(getCellComponent("relation")).toBe(FallbackCell);
  });
});
