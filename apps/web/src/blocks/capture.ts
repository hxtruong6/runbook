// src/blocks/capture.ts
import type { OutputSpec } from "./types";

export function getByPath(obj: unknown, path: string): unknown {
  if (path === "$") return obj;
  const parts = path
    .replace(/\[(\d+)\]/g, ".$1")
    .split(".")
    .filter(Boolean);
  let cur: any = obj;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
}

export function captureOutputs(
  response: unknown,
  outputs: OutputSpec[]
): Record<string, unknown> {
  const captured: Record<string, unknown> = {};
  for (const o of outputs) {
    const v = getByPath(response, o.jsonPath);
    if (v !== undefined) captured[o.contextKey] = v;
  }
  return captured;
}
