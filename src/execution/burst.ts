// src/execution/burst.ts

import { z } from "zod";
import type { BlockRunResult, RuntimeContext } from "../blocks/types";
import type { Scenario } from "../scenarios/types";
import type { Environment } from "../environments/types";
import type { BlockDef } from "../blocks/types";
import { summarizeLatencies } from "./stats";
import { runScenarioFrom } from "./runScenario";

// NOTE: the rule "parallel concurrency forces freshContext=true" is enforced at
// runtime in the executor (T2), NOT here. Zod validates only the value ranges.
export const BurstOptionsSchema = z.object({
  count: z.number().int().min(1).max(200),
  windowMs: z.number().int().min(50).max(60_000),
  concurrency: z.enum(["sequential", "parallel"]),
  freshContext: z.boolean(),
});

export type BurstOptions = z.infer<typeof BurstOptionsSchema>;

/** One element per invocation of the scenario. */
export type BurstRunResult = {
  runIdx: number;               // 0-based
  startedAt: number;            // performance.now() value
  elapsedMs: number;
  status: "ok" | "err";
  /** Index of first failed block within the scenario; undefined when status==="ok". */
  failingBlockIdx?: number;
  /** Top-level error message if any. */
  error?: string;
  /** Per-block results inside this run. */
  blockResults: BlockRunResult[];
};

export type BurstErrorGroup = { message: string; count: number };

export type BurstSummary = {
  options: BurstOptions;
  runs: BurstRunResult[];
  okCount: number;
  errCount: number;
  /** Wall-clock end − start. */
  totalElapsedMs: number;
  latencies: { min: number; p50: number; p95: number; max: number; mean: number };
  /** Sorted by count desc; ties preserve first-seen order. */
  errorGroups: BurstErrorGroup[];
};

// ─── Executor types ───────────────────────────────────────────────────────────

export type BurstDeps = {
  scenario: Scenario;
  scenarioLookup: (id: string) => Scenario | null;
  registry: Record<string, BlockDef>;
  env: Environment | null;
  makeCtx: () => RuntimeContext;
};

export type BurstProgress =
  | { type: "run-started"; runIdx: number; startedAt: number }
  | { type: "run-finished"; result: BurstRunResult }
  | { type: "done"; summary: BurstSummary };

// ─── Internal helpers ─────────────────────────────────────────────────────────

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve) => {
    if (signal?.aborted) { resolve(); return; }
    const id = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => { clearTimeout(id); resolve(); }, { once: true });
  });
}

function buildRunResult(
  runIdx: number,
  startedAt: number,
  blockResults: BlockRunResult[],
): BurstRunResult {
  const firstErr = blockResults.findIndex((r) => r.status === "err");
  const status: "ok" | "err" = firstErr === -1 ? "ok" : "err";
  const elapsedMs = blockResults.reduce((s, r) => s + r.elapsedMs, 0);
  if (status === "err") {
    const errResult = blockResults[firstErr];
    return {
      runIdx,
      startedAt,
      elapsedMs,
      status: "err",
      failingBlockIdx: firstErr,
      error: errResult.status === "err" ? errResult.error : undefined,
      blockResults,
    };
  }
  return { runIdx, startedAt, elapsedMs, status: "ok", blockResults };
}

// ─── runBurst ─────────────────────────────────────────────────────────────────

export async function runBurst(
  options: BurstOptions,
  deps: BurstDeps,
  onProgress?: (ev: BurstProgress) => void,
  signal?: AbortSignal,
): Promise<BurstSummary> {
  // 1. Validate
  BurstOptionsSchema.parse(options);

  // 2. Force freshContext for parallel
  const opts: BurstOptions =
    options.concurrency === "parallel"
      ? { ...options, freshContext: true }
      : options;

  const { count, windowMs, concurrency } = opts;
  const emit = (ev: BurstProgress) => onProgress?.(ev);
  const startWallClock = performance.now();
  const runs: BurstRunResult[] = [];

  async function runOne(i: number, ctx: RuntimeContext): Promise<BurstRunResult> {
    const startedAt = performance.now();
    emit({ type: "run-started", runIdx: i, startedAt });
    const blockResults: BlockRunResult[] = [];
    await runScenarioFrom(
      deps.scenario.blocks,
      0,
      ctx,
      (_c, _idx, result) => blockResults.push(result),
      deps.env,
      deps.registry,
      deps.scenarioLookup,
    );
    const result = buildRunResult(i, startedAt, blockResults);
    emit({ type: "run-finished", result });
    return result;
  }

  if (concurrency === "sequential") {
    const sharedCtx = deps.makeCtx();
    const waitMs = count > 1 ? windowMs / count : 0;
    for (let i = 0; i < count; i++) {
      if (signal?.aborted) break;
      const ctx = opts.freshContext ? deps.makeCtx() : sharedCtx;
      const result = await runOne(i, ctx);
      runs.push(result);
      if (i < count - 1) {
        await sleep(waitMs, signal);
      }
    }
  } else {
    // parallel
    const staggerMs = windowMs / count;
    const promises: Promise<void>[] = [];
    for (let i = 0; i < count; i++) {
      const runIdx = i;
      const delay = runIdx * staggerMs;
      const p = (async () => {
        await sleep(delay, signal);
        if (signal?.aborted) return;
        const ctx = deps.makeCtx();
        const result = await runOne(runIdx, ctx);
        runs.push(result);
      })();
      promises.push(p);
    }
    await Promise.all(promises);
  }

  const totalElapsedMs = performance.now() - startWallClock;
  // Sort runs by runIdx for deterministic ordering
  runs.sort((a, b) => a.runIdx - b.runIdx);
  const summary = makeBurstSummary(opts, runs, totalElapsedMs);
  emit({ type: "done", summary });
  return summary;
}

// ─── Pure aggregation ─────────────────────────────────────────────────────────

/**
 * Pure aggregation: derives okCount/errCount, latency percentiles, and error
 * groups from the completed run array.
 */
export function makeBurstSummary(
  options: BurstOptions,
  runs: BurstRunResult[],
  totalElapsedMs: number,
): BurstSummary {
  let okCount = 0;
  let errCount = 0;

  // Use a Map to preserve insertion (first-seen) order for tie-breaking.
  const errorMap = new Map<string, number>();

  for (const run of runs) {
    if (run.status === "ok") {
      okCount++;
    } else {
      errCount++;
      if (run.error !== undefined) {
        errorMap.set(run.error, (errorMap.get(run.error) ?? 0) + 1);
      }
    }
  }

  // Sort by count desc; Map iteration order gives us first-seen for ties.
  const errorGroups: BurstErrorGroup[] = [...errorMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([message, count]) => ({ message, count }));

  const latencies = summarizeLatencies(runs.map((r) => r.elapsedMs));

  return {
    options,
    runs,
    okCount,
    errCount,
    totalElapsedMs,
    latencies,
    errorGroups,
  };
}
