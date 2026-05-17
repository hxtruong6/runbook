// src/execution/runScenario.ts
// Web adapter for the shared runtime. The actual implementation lives in
// `@runbook/shared` so the CLI and MCP server can reuse it.
import type { BlockDef, BlockInstance, BlockRunResult, RuntimeContext } from "../blocks/types";
import type { Scenario } from "../scenarios/types";
import type { Environment } from "../environments/types";
import { BLOCK_REGISTRY } from "../blocks";
import {
  resolveInputs as sharedResolveInputs,
  runBlock as sharedRunBlock,
  runOneBlock as sharedRunOneBlock,
  runScenarioFrom as sharedRunScenarioFrom,
  defaultFetcher,
} from "@runbook/shared";

export function resolveInputs(
  def: BlockDef,
  inst: BlockInstance,
  ctx: RuntimeContext
): Record<string, unknown> {
  return sharedResolveInputs(def as any, inst as any, ctx as any);
}

export async function runBlock(
  def: BlockDef,
  inst: BlockInstance,
  ctx: RuntimeContext,
  env?: Environment | null
): Promise<BlockRunResult> {
  return sharedRunBlock(def as any, inst as any, ctx as any, env as any, defaultFetcher) as Promise<BlockRunResult>;
}

export async function runOneBlock(
  inst: BlockInstance,
  ctx: RuntimeContext,
  expandingIds: Set<string>,
  scenarioLookup: (id: string) => Scenario | null,
  env: Environment | null | undefined,
  registry: Record<string, BlockDef>,
  onResult: (ctx: RuntimeContext, idx: number, result: BlockRunResult) => void,
  idx: number
) {
  return sharedRunOneBlock(
    inst as any,
    ctx as any,
    expandingIds,
    scenarioLookup as any,
    env as any,
    registry as any,
    defaultFetcher,
    onResult as any,
    idx
  ) as Promise<{ result: BlockRunResult; nextCtx: RuntimeContext; abort: boolean }>;
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
  await sharedRunScenarioFrom(
    blocks as any,
    startIdx,
    initialCtx as any,
    onResult as any,
    {
      registry: (registry ?? BLOCK_REGISTRY) as any,
      scenarioLookup: scenarioLookup as any,
      env: env as any,
      fetcher: defaultFetcher,
    }
  );
}
