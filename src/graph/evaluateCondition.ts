import type { EdgeCondition } from "./types";

function getAtPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((cur, key) => {
    if (cur !== null && typeof cur === "object") {
      return (cur as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

export function evaluateCondition(condition: EdgeCondition, response: unknown): boolean {
  const actual = getAtPath(response, condition.jsonPath);
  if (actual === undefined) return false;
  const { operator, value } = condition;
  switch (operator) {
    case "eq": return actual === value;
    case "neq": return actual !== value;
    case "gt": return typeof actual === "number" && typeof value === "number" && actual > value;
    case "lt": return typeof actual === "number" && typeof value === "number" && actual < value;
    case "contains":
      return typeof actual === "string" && typeof value === "string" && actual.includes(value);
    default: return false;
  }
}
