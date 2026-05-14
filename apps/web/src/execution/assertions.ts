import type { Assertion, AssertionOp } from "../blocks/types";

function getPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc != null && typeof acc === "object") return (acc as Record<string, unknown>)[key];
    return undefined;
  }, obj);
}

export type AssertionResult = {
  assertion: Assertion;
  passed: boolean;
  actual: unknown;
};

export function evaluateAssertions(result: object, assertions: Assertion[]): AssertionResult[] {
  return assertions.map(assertion => {
    const actual = getPath(result, assertion.path);
    const passed = evaluate(actual, assertion.op, assertion.value);
    return { assertion, passed, actual };
  });
}

function evaluate(actual: unknown, op: AssertionOp, expected: unknown): boolean {
  switch (op) {
    case "eq": return actual === expected || String(actual) === String(expected);
    case "neq": return actual !== expected && String(actual) !== String(expected);
    case "gt": return Number(actual) > Number(expected);
    case "lt": return Number(actual) < Number(expected);
    case "contains": return typeof actual === "string" && actual.includes(String(expected));
    case "exists": return actual !== undefined && actual !== null;
    default: return false;
  }
}
