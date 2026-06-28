import { describe, it, expect } from "vitest";
import { isTemplatePropertyRef } from "./template-property-ref";

describe("isTemplatePropertyRef", () => {
  it("accepts a { templatePropertyRef } object", () => {
    expect(isTemplatePropertyRef({ templatePropertyRef: "p-1" })).toBe(true);
  });

  it("rejects a plain page-id string", () => {
    expect(isTemplatePropertyRef("page-1")).toBe(false);
  });

  it("rejects a non-string templatePropertyRef", () => {
    expect(isTemplatePropertyRef({ templatePropertyRef: 123 })).toBe(false);
  });

  it("rejects null, arrays and bare objects", () => {
    expect(isTemplatePropertyRef(null)).toBe(false);
    expect(isTemplatePropertyRef(["p-1"])).toBe(false);
    expect(isTemplatePropertyRef({})).toBe(false);
    expect(isTemplatePropertyRef(undefined)).toBe(false);
  });
});
