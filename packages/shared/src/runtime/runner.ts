import type {
  BlockDef,
  BlockInstance,
  BlockRunResult,
  Environment,
  Fetcher,
  RuntimeContext,
  Scenario,
  ScenarioLookup,
} from './types.js'
import { captureOutputs } from './capture.js'
import { defaultFetcher } from './fetcher.js'
import { nowMs } from './timer.js'
import { SCENARIO_REF_KIND, parseScenarioRefOverrides } from './scenarioRef.js'

export type RunOptions = {
  registry: Record<string, BlockDef>
  scenarioLookup?: ScenarioLookup
  env?: Environment | null
  fetcher?: Fetcher
}

export function resolveInputs(
  def: BlockDef,
  inst: BlockInstance,
  ctx: RuntimeContext
): Record<string, unknown> {
  const values: Record<string, unknown> = {}
  for (const field of def.inputs) {
    if (
      field.name in inst.overrides &&
      inst.overrides[field.name] !== '' &&
      inst.overrides[field.name] !== undefined
    ) {
      values[field.name] = inst.overrides[field.name]
    } else if (field.fromContextKey && ctx[field.fromContextKey] !== undefined) {
      values[field.name] = ctx[field.fromContextKey]
    }
  }
  return values
}

export async function runBlock(
  def: BlockDef,
  inst: BlockInstance,
  ctx: RuntimeContext,
  env: Environment | null | undefined,
  fetcher: Fetcher
): Promise<BlockRunResult> {
  const started = nowMs()
  try {
    const values = resolveInputs(def, inst, ctx)
    const req = def.build(values)
    const { httpStatus, body, elapsedMs, resolvedRequest } = await fetcher(req, {
      auth: def.auth,
      jwt: typeof ctx.jwt === 'string' ? ctx.jwt : undefined,
      envAuth: env?.auth,
      envHeaders: env?.headers,
    })
    if (httpStatus >= 200 && httpStatus < 300) {
      return {
        status: 'ok',
        httpStatus,
        elapsedMs,
        response: body,
        captured: captureOutputs(body, def.outputs),
        request: resolvedRequest,
      }
    }
    return {
      status: 'err',
      httpStatus,
      elapsedMs,
      response: body,
      error: `HTTP ${httpStatus}`,
      request: resolvedRequest,
    }
  } catch (e) {
    return {
      status: 'err',
      elapsedMs: Math.round(nowMs() - started),
      response: null,
      error: (e as Error).message,
    }
  }
}

export async function runOneBlock(
  inst: BlockInstance,
  ctx: RuntimeContext,
  expandingIds: Set<string>,
  scenarioLookup: ScenarioLookup,
  env: Environment | null | undefined,
  registry: Record<string, BlockDef>,
  fetcher: Fetcher,
  onResult: (ctx: RuntimeContext, idx: number, result: BlockRunResult) => void,
  idx: number
): Promise<{ result: BlockRunResult; nextCtx: RuntimeContext; abort: boolean }> {
  if (inst.kind === SCENARIO_REF_KIND) {
    let overrides: ReturnType<typeof parseScenarioRefOverrides>
    try {
      overrides = parseScenarioRefOverrides(inst.overrides)
    } catch (e) {
      const result: BlockRunResult = {
        status: 'err',
        elapsedMs: 0,
        response: null,
        error: `Invalid scenario-ref overrides: ${(e as Error).message}`,
      }
      onResult(ctx, idx, result)
      return { result, nextCtx: ctx, abort: true }
    }

    const { scenarioId, continueOnError, contextOverrides } = overrides

    if (expandingIds.has(scenarioId)) {
      const chain = [...Array.from(expandingIds), scenarioId].join(' → ')
      const result: BlockRunResult = {
        status: 'err',
        elapsedMs: 0,
        response: null,
        error: `Cycle detected: ${chain}`,
      }
      onResult(ctx, idx, result)
      return { result, nextCtx: ctx, abort: true }
    }

    const subScenario = scenarioLookup(scenarioId)
    if (!subScenario) {
      const result: BlockRunResult = {
        status: 'err',
        elapsedMs: 0,
        response: null,
        error: `Unknown scenario id: ${scenarioId}`,
      }
      onResult(ctx, idx, result)
      return { result, nextCtx: ctx, abort: true }
    }

    let subCtx: RuntimeContext = contextOverrides
      ? ({ ...ctx, ...contextOverrides } as RuntimeContext)
      : { ...ctx }

    const subResults: BlockRunResult[] = []
    const nextExpandingIds = new Set(expandingIds)
    nextExpandingIds.add(scenarioId)

    const started = nowMs()

    for (let si = 0; si < subScenario.blocks.length; si++) {
      const subInst = subScenario.blocks[si]
      const {
        result: subResult,
        nextCtx: nextSubCtx,
        abort: subAbort,
      } = await runOneBlock(
        subInst,
        subCtx,
        nextExpandingIds,
        scenarioLookup,
        env,
        registry,
        fetcher,
        () => {
          /* sub-results collected via subResults array */
        },
        si
      )
      subResults.push(subResult)
      subCtx = nextSubCtx
      if (subAbort) break
    }

    const elapsedMs = Math.round(nowMs() - started)
    const failedIdx = subResults.findIndex((r) => r.status === 'err')
    const allOk = failedIdx === -1

    let compositeResult: BlockRunResult
    if (allOk) {
      compositeResult = {
        status: 'ok',
        httpStatus: 0,
        elapsedMs,
        response: null,
        captured: {},
        subResults,
      }
    } else {
      const failedResult = subResults[failedIdx]
      const failedError =
        failedResult.status === 'err'
          ? failedResult.error
          : `Sub-scenario failed at block ${failedIdx}`
      compositeResult = {
        status: 'err',
        elapsedMs,
        response: null,
        error: failedError,
        subResults,
      }
    }

    const nextCtx = allOk ? subCtx : ctx
    const finalCtx =
      allOk && contextOverrides
        ? ({ ...nextCtx, ...contextOverrides } as RuntimeContext)
        : nextCtx

    onResult(finalCtx, idx, compositeResult)

    const abort = compositeResult.status === 'err' && !continueOnError
    return { result: compositeResult, nextCtx: finalCtx, abort }
  }

  const def = registry[inst.kind]
  if (!def) {
    const result: BlockRunResult = {
      status: 'err',
      elapsedMs: 0,
      response: null,
      error: `Unknown block kind: ${inst.kind}`,
    }
    onResult(ctx, idx, result)
    return { result, nextCtx: ctx, abort: true }
  }

  if (def.kind === 'socketConnect') {
    const result: BlockRunResult = {
      status: 'ok',
      httpStatus: 0,
      elapsedMs: 0,
      response: 'skipped (socket)',
      captured: {},
    }
    onResult(ctx, idx, result)
    return { result, nextCtx: ctx, abort: false }
  }

  const result = await runBlock(def, inst, ctx, env, fetcher)
  const nextCtx = result.status === 'ok' ? { ...ctx, ...result.captured } : ctx
  onResult(nextCtx, idx, result)
  const abort = result.status === 'err'
  return { result, nextCtx, abort }
}

export async function runScenarioFrom(
  blocks: BlockInstance[],
  startIdx: number,
  initialCtx: RuntimeContext,
  onResult: (ctx: RuntimeContext, idx: number, result: BlockRunResult) => void,
  options: RunOptions
): Promise<void> {
  const registry = options.registry
  const lookup: ScenarioLookup = options.scenarioLookup ?? (() => null)
  const env = options.env ?? null
  const fetcher = options.fetcher ?? defaultFetcher
  const expandingIds = new Set<string>()

  let ctx = initialCtx
  for (let i = startIdx; i < blocks.length; i++) {
    const inst = blocks[i]
    const { nextCtx, abort } = await runOneBlock(
      inst,
      ctx,
      expandingIds,
      lookup,
      env,
      registry,
      fetcher,
      onResult,
      i
    )
    ctx = nextCtx
    if (abort) return
  }
}

export type { Scenario }
