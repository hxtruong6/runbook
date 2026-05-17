// End-to-end inference test against a running cworld-be server.
// Skipped automatically when the server is unreachable.
import { beforeAll, describe, expect, it } from 'vitest'
import { captureFromResult } from '../../src/inference/index.js'

const BASE = process.env.CWORLD_BASE ?? 'http://127.0.0.1:4000'

let serverUp = false

beforeAll(async () => {
  try {
    const r = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(800) })
    serverUp = r.ok
  } catch {
    serverUp = false
  }
})

async function callJson(path: string): Promise<{ httpStatus: number; body: unknown }> {
  const res = await fetch(`${BASE}${path}`)
  const text = await res.text()
  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    body = text
  }
  return { httpStatus: res.status, body }
}

describe.runIf(true)('e2e: schema inference against cworld-be', () => {
  it.runIf(true)('captures /api/health 2xx, merges, no drift across identical runs', async () => {
    if (!serverUp) return // ← soft-skip when server is offline
    const a = await callJson('/api/health')
    const c1 = captureFromResult(undefined, a)
    expect(c1).not.toBeNull()
    expect(c1!.observation.family).toBe('2xx')

    const b = await callJson('/api/health')
    const c2 = captureFromResult(c1!.next, b)
    expect(c2!.next.runs).toBe(2)
    expect(c2!.drift.length).toBe(0)

    const s = c2!.next.schemas['2xx'] as { type: string; required: string[] }
    expect(s.type).toBe('object')
    expect(s.required).toContain('status')
  })

  it('captures /api/health/welcome with nested object + integer fields', async () => {
    if (!serverUp) return
    const w = await callJson('/api/health/welcome')
    const cap = captureFromResult(undefined, w)
    expect(cap).not.toBeNull()

    const root = cap!.next.schemas['2xx'] as {
      properties: Record<string, { type: string; properties?: Record<string, { type: string; integer?: boolean }> }>
    }
    expect(root.properties.message3.type).toBe('object')
    const day = root.properties.message3.properties!.day
    expect(day.type).toBe('number')
    expect(day.integer).toBe(true)
  })

  it('keeps error-family schema separate from 2xx', async () => {
    if (!serverUp) return
    const ok = await callJson('/api/health')
    const errResp = await callJson('/api/v1/nakama/profile')
    expect(errResp.httpStatus).toBeGreaterThanOrEqual(400)

    const c1 = captureFromResult(undefined, ok)!
    const c2 = captureFromResult(c1.next, errResp)!
    expect(c2.observation.family).not.toBe('2xx')
    // 2xx schema untouched by the error
    const ok2xx = c2.next.schemas['2xx'] as { required: string[] }
    expect(ok2xx.required).toContain('status')
    // error schema present in its own family
    const errFamilySchema = c2.next.schemas[c2.observation.family] as {
      properties: Record<string, unknown>
    }
    expect(
      errFamilySchema.properties.error || errFamilySchema.properties.message
    ).toBeDefined()
  })

  it('reports drift when a leaf type changes between runs', async () => {
    if (!serverUp) return
    // Synthetic — drift detection is type-level so we don't need a real API quirk
    const a = captureFromResult(undefined, {
      httpStatus: 200,
      body: { status: 'ok' },
    })!
    const b = captureFromResult(a.next, {
      httpStatus: 200,
      body: { status: { code: 1, label: 'ok' } },
    })!
    expect(b.drift.length).toBeGreaterThan(0)
    expect(b.drift[0]).toMatchObject({
      path: '$.status',
      before: 'string',
      after: 'object',
    })
  })

  it('redacts sensitive fields from stored examples', async () => {
    if (!serverUp) return
    const c = captureFromResult(undefined, {
      httpStatus: 200,
      body: { id: 1, password: 'hunter2', token: 'eyJhbGciOiJIUzI1NiJ9.x.y' },
    })!
    const ex = c.next.examples['2xx'] as Record<string, unknown>
    expect(ex.id).toBe(1)
    expect(ex.password).not.toBe('hunter2')
    expect(ex.token).not.toBe('eyJhbGciOiJIUzI1NiJ9.x.y')
  })
})
