import { describe, it, expect } from "vitest";
import { isThisPageRef, resolveSelfRefFilters } from "./self-ref";
import { IFilterCondition } from "@/features/database/types/database.types.ts";

describe("isThisPageRef", () => {
  it("recognizes the { thisPage: true } symbol", () => {
    expect(isThisPageRef({ thisPage: true })).toBe(true);
  });
  it("rejects literals, arrays and other objects", () => {
    expect(isThisPageRef("page-1")).toBe(false);
    expect(isThisPageRef(null)).toBe(false);
    expect(isThisPageRef(["page-1"])).toBe(false);
    expect(isThisPageRef({ thisPage: false })).toBe(false);
    expect(isThisPageRef({ templatePropertyRef: "x" })).toBe(false);
  });
});

describe("resolveSelfRefFilters", () => {
  const rel = (value: unknown): IFilterCondition => ({
    propertyId: "rel",
    op: "contains",
    value,
  });

  it("substitutes the host page id for a { thisPage } value", () => {
    const out = resolveSelfRefFilters([rel({ thisPage: true })], "host-1");
    expect(out).toEqual([{ propertyId: "rel", op: "contains", value: "host-1" }]);
  });

  it("drops a { thisPage } filter when there is no host page", () => {
    expect(resolveSelfRefFilters([rel({ thisPage: true })], undefined)).toEqual(
      [],
    );
  });

  it("passes non-self-ref filters through untouched", () => {
    const literal = rel("page-9");
    const text: IFilterCondition = {
      propertyId: "t",
      op: "contains",
      value: "abc",
    };
    expect(resolveSelfRefFilters([literal, text], "host-1")).toEqual([
      literal,
      text,
    ]);
  });
});
