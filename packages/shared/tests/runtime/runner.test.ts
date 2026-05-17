import { describe, it, expect } from 'vitest'
import {
  runScenarioFrom,
  type BlockDef,
  type BlockRunResult,
  type Fetcher,
  type RuntimeContext,
  type Scenario,
} from '../../src/runtime/index.js'

function makeOkFetcher(body: unknown, status = 200): Fetcher {
  return async (req) => ({
    httpStatus: status,
    body,
    elapsedMs: 1,
    resolvedRequest: { method: req.method, url: req.url, headers: req.headers, body: req.body },
  })
}

function makeOkDef(kind: string, capturedKey?: string): BlockDef {
  return {
    kind,
    label: kind,
    auth: 'none',
    inputs: [],
    outputs: capturedKey ? [{ jsonPath: 'token', contextKey: capturedKey }] : [],
    build: () => ({ method: 'GET', url: 'https://x/', headers: {} }),
  }
}

describe('runScenarioFrom (shared)', () => {
  it('runs a chain of blocks and captures outputs into ctx', async () => {
    const fetcher = makeOkFetcher({ token: 'tok-1' })
    const registry = { a: makeOkDef('a', 'jwt'), b: makeOkDef('b') }
    const results: Array<{ idx: number; result: BlockRunResult }> = []
    let finalCtx: RuntimeContext = { socketSessionUuid: '' }

    await runScenarioFrom(
      [
        { id: '1', kind: 'a', overrides: {} },
        { id: '2', kind: 'b', overrides: {} },
      ],
      0,
      { socketSessionUuid: '' },
      (ctx, idx, result) => {
        finalCtx = ctx
        results.push({ idx, result })
      },
      { registry, fetcher }
    )

    expect(results).toHaveLength(2)
    expect(results[0].result.status).toBe('ok')
    expect(results[1].result.status).toBe('ok')
    expect(finalCtx.jwt).toBe('tok-1')
  })

  it('stops on first error', async () => {
    let calls = 0
    const fetcher: Fetcher = async (req) => {
      calls++
      return {
        httpStatus: calls === 1 ? 200 : 500,
        body: {},
        elapsedMs: 1,
        resolvedRequest: { method: req.method, url: req.url, headers: req.headers },
      }
    }
    const registry = { a: makeOkDef('a'), b: makeOkDef('b'), c: makeOkDef('c') }
    const results: BlockRunResult[] = []
    await runScenarioFrom(
      [
        { id: '1', kind: 'a', overrides: {} },
        { id: '2', kind: 'b', overrides: {} },
        { id: '3', kind: 'c', overrides: {} },
      ],
      0,
      { socketSessionUuid: '' },
      (_ctx, _idx, result) => {
        results.push(result)
      },
      { registry, fetcher }
    )
    expect(results).toHaveLength(2)
    expect(results[0].status).toBe('ok')
    expect(results[1].status).toBe('err')
    expect(calls).toBe(2)
  })

  it('reports unknown block kind as err', async () => {
    const registry = {}
    const fetcher = makeOkFetcher({})
    const results: BlockRunResult[] = []
    await runScenarioFrom(
      [{ id: '1', kind: 'missing', overrides: {} }],
      0,
      { socketSessionUuid: '' },
      (_ctx, _idx, r) => results.push(r),
      { registry, fetcher }
    )
    expect(results[0].status).toBe('err')
    if (results[0].status === 'err') {
      expect(results[0].error).toMatch(/Unknown block kind/)
    }
  })

  it('expands scenario-ref via scenarioLookup', async () => {
    const sub: Scenario = {
      id: 'sub',
      name: 'sub',
      createdAt: '2026-01-01',
      blocks: [{ id: 's1', kind: 'a', overrides: {} }],
    }
    const registry = { a: makeOkDef('a') }
    const fetcher = makeOkFetcher({})
    const results: BlockRunResult[] = []
    await runScenarioFrom(
      [{ id: 'p1', kind: 'scenario-ref', overrides: { scenarioId: 'sub' } }],
      0,
      { socketSessionUuid: '' },
      (_ctx, _idx, r) => results.push(r),
      {
        registry,
        fetcher,
        scenarioLookup: (id) => (id === 'sub' ? sub : null),
      }
    )
    expect(results).toHaveLength(1)
    expect(results[0].status).toBe('ok')
    expect(results[0].subResults).toHaveLength(1)
  })

  it('detects cycles in scenario-ref', async () => {
    const a: Scenario = {
      id: 'A',
      name: 'A',
      createdAt: '2026-01-01',
      blocks: [{ id: 'a1', kind: 'scenario-ref', overrides: { scenarioId: 'B' } }],
    }
    const b: Scenario = {
      id: 'B',
      name: 'B',
      createdAt: '2026-01-01',
      blocks: [{ id: 'b1', kind: 'scenario-ref', overrides: { scenarioId: 'A' } }],
    }
    const results: BlockRunResult[] = []
    await runScenarioFrom(
      [{ id: 'p1', kind: 'scenario-ref', overrides: { scenarioId: 'A' } }],
      0,
      { socketSessionUuid: '' },
      (_ctx, _idx, r) => results.push(r),
      {
        registry: {},
        fetcher: makeOkFetcher({}),
        scenarioLookup: (id) => (id === 'A' ? a : id === 'B' ? b : null),
      }
    )
    expect(results[0].status).toBe('err')
    if (results[0].status === 'err') {
      expect(results[0].error).toMatch(/Cycle detected/)
    }
  })
})
