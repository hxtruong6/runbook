import { describe, it, expect } from "vitest";
import { evaluateCondition } from "../../src/graph/evaluateCondition";
import type { EdgeCondition } from "../../src/graph/types";

const response = { data: { status: "active", count: 5, label: "hello world" } };

describe("evaluateCondition", () => {
  it("eq matches equal value", () => {
    const c: EdgeCondition = { jsonPath: "data.status", operator: "eq", value: "active" };
    expect(evaluateCondition(c, response)).toBe(true);
  });

  it("eq rejects unequal value", () => {
    const c: EdgeCondition = { jsonPath: "data.status", operator: "eq", value: "inactive" };
    expect(evaluateCondition(c, response)).toBe(false);
  });

  it("neq passes when different", () => {
    const c: EdgeCondition = { jsonPath: "data.status", operator: "neq", value: "inactive" };
    expect(evaluateCondition(c, response)).toBe(true);
  });

  it("gt passes when value is greater", () => {
    const c: EdgeCondition = { jsonPath: "data.count", operator: "gt", value: 3 };
    expect(evaluateCondition(c, response)).toBe(true);
  });

  it("lt passes when value is less", () => {
    const c: EdgeCondition = { jsonPath: "data.count", operator: "lt", value: 10 };
    expect(evaluateCondition(c, response)).toBe(true);
  });

  it("contains passes when string includes value", () => {
    const c: EdgeCondition = { jsonPath: "data.label", operator: "contains", value: "hello" };
    expect(evaluateCondition(c, response)).toBe(true);
  });

  it("returns false for missing jsonPath", () => {
    const c: EdgeCondition = { jsonPath: "data.missing", operator: "eq", value: "x" };
    expect(evaluateCondition(c, response)).toBe(false);
  });

  it("returns false for non-numeric gt comparison", () => {
    const c: EdgeCondition = { jsonPath: "data.status", operator: "gt", value: 1 };
    expect(evaluateCondition(c, response)).toBe(false);
  });
});
