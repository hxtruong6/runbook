import { describe, it, expect } from 'vitest'
import {
  captureFromResult,
  detectDrift,
  familyOf,
  inferSchema,
  mergeSchemas,
  type BlockInference,
} from '../../src/inference/index.js'

describe('inferSchema', () => {
  it('detects primitive types', () => {
    expect(inferSchema('hello')).toEqual({ type: 'string' })
    expect(inferSchema(42)).toEqual({ type: 'number', integer: true })
    expect(inferSchema(3.14)).toEqual({ type: 'number', integer: false })
    expect(inferSchema(true)).toEqual({ type: 'boolean' })
    expect(inferSchema(null)).toEqual({ type: 'null' })
  })

  it('detects string formats', () => {
    expect(inferSchema('2024-03-12T10:00:00Z')).toEqual({
      type: 'string',
      format: 'date-time',
    })
    expect(inferSchema('user@example.com')).toEqual({
      type: 'string',
      format: 'email',
    })
    expect(inferSchema('11111111-2222-3333-4444-555555555555')).toEqual({
      type: 'string',
      format: 'uuid',
    })
  })

  it('infers object with required keys', () => {
    const s = inferSchema({ id: 1, email: 'a@b.co' })
    expect(s).toEqual({
      type: 'object',
      properties: {
        id: { type: 'number', integer: true },
        email: { type: 'string', format: 'email' },
      },
      required: ['id', 'email'],
    })
  })

  it('infers homogeneous arrays', () => {
    const s = inferSchema([1, 2, 3])
    expect(s).toEqual({
      type: 'array',
      items: { type: 'number', integer: true },
    })
  })

  it('handles empty arrays as unknown items', () => {
    expect(inferSchema([])).toEqual({ type: 'array', items: { type: 'unknown' } })
  })
})

describe('mergeSchemas', () => {
  it('intersects required keys across observations', () => {
    const a = inferSchema({ id: 1, email: 'a@b.co' })
    const b = inferSchema({ id: 2, phone: '123' })
    const m = mergeSchemas(a, b)
    expect(m.type).toBe('object')
    if (m.type !== 'object') return
    expect(m.required).toEqual(['id'])
    expect(Object.keys(m.properties).sort()).toEqual(['email', 'id', 'phone'])
  })

  it('null + T → nullable T', () => {
    const m = mergeSchemas({ type: 'string' }, { type: 'null' })
    expect(m).toEqual({ type: 'string', nullable: true })
  })

  it('integer narrows to number when one observation is fractional', () => {
    const a = inferSchema(1)
    const b = inferSchema(1.5)
    const m = mergeSchemas(a, b)
    expect(m).toEqual({ type: 'number', integer: false, nullable: undefined })
  })

  it('different types → union', () => {
    const m = mergeSchemas({ type: 'string' }, { type: 'number' })
    expect(m.type).toBe('union')
  })

  it('drops format when observations disagree', () => {
    const m = mergeSchemas(
      { type: 'string', format: 'email' },
      { type: 'string', format: 'uuid' }
    )
    expect(m).toEqual({ type: 'string', nullable: undefined, format: undefined })
  })
})

describe('detectDrift', () => {
  it('reports zero drift for identical shapes', () => {
    const a = inferSchema({ id: 1 })
    const b = inferSchema({ id: 2 })
    expect(detectDrift(a, b)).toEqual([])
  })

  it('reports drift when leaf type changes', () => {
    const a = inferSchema({ status: 'active' })
    const b = inferSchema({ status: { code: 1, label: 'active' } })
    const d = detectDrift(a, b)
    expect(d.length).toBe(1)
    expect(d[0].path).toBe('$.status')
    expect(d[0].before).toBe('string')
    expect(d[0].after).toBe('object')
  })

  it('does not report drift when one side is null (optional)', () => {
    const a = inferSchema({ email: 'a@b.co' })
    const b = inferSchema({ email: null })
    expect(detectDrift(a, b)).toEqual([])
  })
})

describe('familyOf', () => {
  it.each([
    [200, '2xx'],
    [201, '2xx'],
    [299, '2xx'],
    [400, '4xx'],
    [404, '4xx'],
    [500, '5xx'],
    [0, 'network'],
    [undefined, 'network'],
  ])('status %s → %s', (status, expected) => {
    expect(familyOf(status as number | undefined)).toBe(expected)
  })
})

describe('captureFromResult', () => {
  it('captures fresh schema on first observation', () => {
    const res = captureFromResult(undefined, {
      httpStatus: 200,
      body: { id: 1, email: 'a@b.co' },
    })
    expect(res).not.toBeNull()
    expect(res!.next.runs).toBe(1)
    expect(res!.next.schemas['2xx']?.type).toBe('object')
    expect(res!.next.examples['2xx']).toBeDefined()
    expect(res!.drift).toEqual([])
  })

  it('merges across runs and keeps families separate', () => {
    const a = captureFromResult(undefined, {
      httpStatus: 200,
      body: { id: 1 },
    })!.next
    const b = captureFromResult(a, {
      httpStatus: 200,
      body: { id: 2, name: 'x' },
    })!.next
    expect(b.runs).toBe(2)
    const s = b.schemas['2xx']
    expect(s?.type).toBe('object')
    if (s?.type === 'object') {
      expect(s.required).toEqual(['id'])
    }

    const c = captureFromResult(b, {
      httpStatus: 404,
      body: { error: 'not found' },
    })!.next
    expect(c.schemas['4xx']?.type).toBe('object')
    expect(c.schemas['2xx']?.type).toBe('object') // untouched
  })

  it('returns null for network errors', () => {
    expect(captureFromResult(undefined, { httpStatus: 0, body: null })).toBeNull()
    expect(captureFromResult(undefined, { httpStatus: undefined, body: null })).toBeNull()
  })

  it('reports drift in the next.lastDrift field', () => {
    const a = captureFromResult(undefined, {
      httpStatus: 200,
      body: { status: 'active' },
    })!.next
    const b = captureFromResult(a, {
      httpStatus: 200,
      body: { status: { code: 1 } },
    })!
    expect(b.drift.length).toBeGreaterThan(0)
    expect(b.next.lastDrift).toBeDefined()
  })

  it('redacts sensitive fields from saved examples', () => {
    const res = captureFromResult(undefined, {
      httpStatus: 200,
      body: { id: 1, password: 'super-secret', token: 'abc.def.ghi' },
    })!
    const ex = res.next.examples['2xx'] as Record<string, unknown>
    expect(ex.id).toBe(1)
    expect(ex.password).not.toBe('super-secret')
    expect(ex.token).not.toBe('abc.def.ghi')
  })

  it('keeps prev when input has no body', () => {
    const inf: BlockInference = {
      schemas: { '2xx': { type: 'string' } },
      examples: { '2xx': 'hello' },
      runs: 1,
    }
    expect(captureFromResult(inf, { httpStatus: 200, body: null })).toBeNull()
  })
})
