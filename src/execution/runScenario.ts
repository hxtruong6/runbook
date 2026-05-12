// src/execution/runScenario.ts
import type { BlockDef, BlockInstance, BlockRunResult, RuntimeContext } from "../blocks/types";
import type { Scenario } from "../scenarios/types";
import { BLOCK_REGISTRY } from "../blocks";
import { runRequest } from "../api/fetcher";
import { captureOutputs } from "../blocks/capture";

export function resolveInputs(
  def: BlockDef,
  inst: BlockInstance,
  ctx: RuntimeContext
): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const field of def.inputs) {
    if (field.name in inst.overrides && inst.overrides[field.name] !== "" && inst.overrides[field.name] !== undefined) {
      values[field.name] = inst.overrides[field.name];
    } else if (field.fromContextKey && ctx[field.fromContextKey] !== undefined) {
      values[field.name] = ctx[field.fromContextKey];
    }
  }
  return values;
}

export async function runBlock(
  def: BlockDef,
  inst: BlockInstance,
  ctx: RuntimeContext
): Promise<BlockRunResult> {
  const started = performance.now();
  try {
    const values = resolveInputs(def, inst, ctx);
    const req = def.build(values);
    const { httpStatus, body, elapsedMs } = await runRequest(req, {
      auth: def.auth,
      jwt: typeof ctx.jwt === "string" ? ctx.jwt : undefined,
    });
    if (httpStatus >= 200 && httpStatus < 300) {
      return {
        status: "ok",
        httpStatus,
        elapsedMs,
        response: body,
        captured: captureOutputs(body, def.outputs),
      };
    }
    return {
      status: "err",
      httpStatus,
      elapsedMs,
      response: body,
      error: `HTTP ${httpStatus}`,
    };
  } catch (e) {
    return {
      status: "err",
      elapsedMs: Math.round(performance.now() - started),
      response: null,
      error: (e as Error).message,
    };
  }
}

export async function runScenarioFrom(
  blocks: Scenario["blocks"],
  startIdx: number,
  initialCtx: RuntimeContext,
  onResult: (ctx: RuntimeContext, idx: number, result: BlockRunResult) => void
): Promise<void> {
  let ctx = initialCtx;
  for (let i = startIdx; i < blocks.length; i++) {
    const inst = blocks[i];
    const def = BLOCK_REGISTRY[inst.kind];
    if (!def) {
      onResult(ctx, i, {
        status: "err",
        elapsedMs: 0,
        response: null,
        error: `Unknown block kind: ${inst.kind}`,
      });
      return;
    }
    if (def.kind === "socketConnect") {
      onResult(ctx, i, { status: "ok", httpStatus: 0, elapsedMs: 0, response: "skipped (socket)", captured: {} });
      continue;
    }
    const result = await runBlock(def, inst, ctx);
    if (result.status === "ok") {
      ctx = { ...ctx, ...result.captured };
    }
    onResult(ctx, i, result);
    if (result.status === "err") return;
  }
}
