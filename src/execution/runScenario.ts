// src/execution/runScenario.ts
import type { BlockDef, BlockInstance, BlockRunResult, RuntimeContext } from "../blocks/types";
import type { Scenario } from "../scenarios/types";
import type { Environment } from "../environments/types";
import { BLOCK_REGISTRY } from "../blocks";
import { runRequest } from "../api/fetcher";
import { captureOutputs } from "../blocks/capture";
import { SCENARIO_REF_KIND, parseScenarioRefOverrides } from "../blocks/scenarioRef";

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
  ctx: RuntimeContext,
  env?: Environment | null
): Promise<BlockRunResult> {
  const started = performance.now();
  try {
    const values = resolveInputs(def, inst, ctx);
    const req = def.build(values);
    const { httpStatus, body, elapsedMs } = await runRequest(req, {
      auth: def.auth,
      jwt: typeof ctx.jwt === "string" ? ctx.jwt : undefined,
      envAuth: env?.auth,
      envHeaders: env?.headers,
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

/**
 * Run one block instance. Returns the result, the updated context, and whether
 * the parent loop should abort.
 */
export async function runOneBlock(
  inst: BlockInstance,
  ctx: RuntimeContext,
  expandingIds: Set<string>,
  scenarioLookup: (id: string) => Scenario | null,
  env: Environment | null | undefined,
  registry: Record<string, BlockDef>,
  onResult: (ctx: RuntimeContext, idx: number, result: BlockRunResult) => void,
  idx: number
): Promise<{ result: BlockRunResult; nextCtx: RuntimeContext; abort: boolean }> {

  // ── scenario-ref expansion ────────────────────────────────────────────────
  if (inst.kind === SCENARIO_REF_KIND) {
    // 1. Parse overrides
    let overrides: ReturnType<typeof parseScenarioRefOverrides>;
    try {
      overrides = parseScenarioRefOverrides(inst.overrides);
    } catch (e) {
      const result: BlockRunResult = {
        status: "err",
        elapsedMs: 0,
        response: null,
        error: `Invalid scenario-ref overrides: ${(e as Error).message}`,
      };
      onResult(ctx, idx, result);
      return { result, nextCtx: ctx, abort: true };
    }

    const { scenarioId, continueOnError, contextOverrides } = overrides;

    // 4. Cycle check
    if (expandingIds.has(scenarioId)) {
      const chain = [...Array.from(expandingIds), scenarioId].join(" → ");
      const result: BlockRunResult = {
        status: "err",
        elapsedMs: 0,
        response: null,
        error: `Cycle detected: ${chain}`,
      };
      onResult(ctx, idx, result);
      return { result, nextCtx: ctx, abort: true };
    }

    // 2. Resolve scenario
    const subScenario = scenarioLookup(scenarioId);
    if (!subScenario) {
      const result: BlockRunResult = {
        status: "err",
        elapsedMs: 0,
        response: null,
        error: `Unknown scenario id: ${scenarioId}`,
      };
      onResult(ctx, idx, result);
      return { result, nextCtx: ctx, abort: true };
    }

    // 5. Apply contextOverrides (shallow merge)
    let subCtx: RuntimeContext = contextOverrides
      ? { ...ctx, ...contextOverrides } as RuntimeContext
      : { ...ctx };

    // 6. Recurse into sub-scenario, collecting subResults
    const subResults: BlockRunResult[] = [];
    const nextExpandingIds = new Set(expandingIds);
    nextExpandingIds.add(scenarioId);

    const started = performance.now();

    for (let si = 0; si < subScenario.blocks.length; si++) {
      const subInst = subScenario.blocks[si];
      const { result: subResult, nextCtx: nextSubCtx, abort: subAbort } = await runOneBlock(
        subInst,
        subCtx,
        nextExpandingIds,
        scenarioLookup,
        env,
        registry,
        () => { /* sub-results collected via subResults array, not propagated upward */ },
        si
      );
      subResults.push(subResult);
      subCtx = nextSubCtx;
      if (subAbort) break;
    }

    const elapsedMs = Math.round(performance.now() - started);
    const failedIdx = subResults.findIndex(r => r.status === "err");
    const allOk = failedIdx === -1;

    // 7. Aggregate composite result
    let compositeResult: BlockRunResult;
    if (allOk) {
      compositeResult = {
        status: "ok",
        httpStatus: 0,
        elapsedMs,
        response: null,
        captured: {},
        subResults,
      };
    } else {
      const failedResult = subResults[failedIdx];
      const failedError = failedResult.status === "err" ? failedResult.error : `Sub-scenario failed at block ${failedIdx}`;
      compositeResult = {
        status: "err",
        elapsedMs,
        response: null,
        error: failedError,
        subResults,
      };
    }

    // Propagate sub-ctx upward so parent can see captured outputs
    const nextCtx = allOk ? subCtx : ctx;

    // Apply contextOverrides to nextCtx if sub succeeded (so they persist)
    const finalCtx = allOk && contextOverrides
      ? { ...nextCtx, ...contextOverrides } as RuntimeContext
      : nextCtx;

    onResult(finalCtx, idx, compositeResult);

    // 8/9. Abort behavior
    const abort = compositeResult.status === "err" && !continueOnError;
    return { result: compositeResult, nextCtx: finalCtx, abort };
  }

  // ── normal block ──────────────────────────────────────────────────────────
  const def = registry[inst.kind];
  if (!def) {
    const result: BlockRunResult = {
      status: "err",
      elapsedMs: 0,
      response: null,
      error: `Unknown block kind: ${inst.kind}`,
    };
    onResult(ctx, idx, result);
    return { result, nextCtx: ctx, abort: true };
  }

  if (def.kind === "socketConnect") {
    const result: BlockRunResult = { status: "ok", httpStatus: 0, elapsedMs: 0, response: "skipped (socket)", captured: {} };
    onResult(ctx, idx, result);
    return { result, nextCtx: ctx, abort: false };
  }

  const result = await runBlock(def, inst, ctx, env);
  const nextCtx = result.status === "ok"
    ? { ...ctx, ...result.captured }
    : ctx;
  onResult(nextCtx, idx, result);
  const abort = result.status === "err";
  return { result, nextCtx, abort };
}

export async function runScenarioFrom(
  blocks: Scenario["blocks"],
  startIdx: number,
  initialCtx: RuntimeContext,
  onResult: (ctx: RuntimeContext, idx: number, result: BlockRunResult) => void,
  env?: Environment | null,
  registry?: Record<string, BlockDef>,
  scenarioLookup?: (id: string) => Scenario | null
): Promise<void> {
  const reg = registry ?? BLOCK_REGISTRY;
  const lookup = scenarioLookup ?? (() => null);
  const expandingIds = new Set<string>();

  let ctx = initialCtx;
  for (let i = startIdx; i < blocks.length; i++) {
    const inst = blocks[i];
    const { nextCtx, abort } = await runOneBlock(
      inst,
      ctx,
      expandingIds,
      lookup,
      env,
      reg,
      onResult,
      i
    );
    ctx = nextCtx;
    if (abort) return;
  }
}
