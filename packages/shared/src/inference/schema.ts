// JSON-Schema-lite inference. Not a full Draft 2020-12 implementation —
// we keep only what's useful for documenting API responses inside a bundle.

export type InferredSchema =
  | { type: 'null' }
  | { type: 'string'; nullable?: boolean; format?: 'date-time' | 'email' | 'uuid' }
  | { type: 'number'; nullable?: boolean; integer?: boolean }
  | { type: 'boolean'; nullable?: boolean }
  | { type: 'array'; items: InferredSchema; nullable?: boolean }
  | {
      type: 'object'
      properties: Record<string, InferredSchema>
      required: string[]
      nullable?: boolean
    }
  | { type: 'union'; anyOf: InferredSchema[] }
  | { type: 'unknown' }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function detectStringFormat(s: string): 'date-time' | 'email' | 'uuid' | undefined {
  if (UUID_RE.test(s)) return 'uuid'
  if (ISO_DATE_RE.test(s)) return 'date-time'
  if (EMAIL_RE.test(s)) return 'email'
  return undefined
}

export function inferSchema(value: unknown): InferredSchema {
  if (value === null) return { type: 'null' }
  if (typeof value === 'string') {
    const format = detectStringFormat(value)
    return format ? { type: 'string', format } : { type: 'string' }
  }
  if (typeof value === 'number') {
    return { type: 'number', integer: Number.isInteger(value) }
  }
  if (typeof value === 'boolean') return { type: 'boolean' }
  if (Array.isArray(value)) {
    if (value.length === 0) return { type: 'array', items: { type: 'unknown' } }
    let items = inferSchema(value[0])
    for (let i = 1; i < value.length; i++) {
      items = mergeSchemas(items, inferSchema(value[i]))
    }
    return { type: 'array', items }
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>
    const properties: Record<string, InferredSchema> = {}
    const required: string[] = []
    for (const [k, v] of Object.entries(obj)) {
      properties[k] = inferSchema(v)
      if (v !== undefined) required.push(k)
    }
    return { type: 'object', properties, required }
  }
  return { type: 'unknown' }
}

// Merge two schemas as observations of the same field. Both required arrays
// are intersected (a property is required only if seen in every observation).
export function mergeSchemas(a: InferredSchema, b: InferredSchema): InferredSchema {
  if (a.type === 'unknown') return b
  if (b.type === 'unknown') return a

  // null + T → nullable T
  if (a.type === 'null' && b.type !== 'null') return withNullable(b)
  if (b.type === 'null' && a.type !== 'null') return withNullable(a)
  if (a.type === 'null' && b.type === 'null') return { type: 'null' }

  // Same primitive: widen format/integer
  if (a.type === 'string' && b.type === 'string') {
    return {
      type: 'string',
      nullable: a.nullable || b.nullable,
      format: a.format === b.format ? a.format : undefined,
    }
  }
  if (a.type === 'number' && b.type === 'number') {
    return {
      type: 'number',
      nullable: a.nullable || b.nullable,
      integer: !!(a.integer && b.integer),
    }
  }
  if (a.type === 'boolean' && b.type === 'boolean') {
    return { type: 'boolean', nullable: a.nullable || b.nullable }
  }

  if (a.type === 'array' && b.type === 'array') {
    return {
      type: 'array',
      items: mergeSchemas(a.items, b.items),
      nullable: a.nullable || b.nullable,
    }
  }

  if (a.type === 'object' && b.type === 'object') {
    const keys = new Set([...Object.keys(a.properties), ...Object.keys(b.properties)])
    const properties: Record<string, InferredSchema> = {}
    for (const k of keys) {
      const av = a.properties[k]
      const bv = b.properties[k]
      if (av && bv) properties[k] = mergeSchemas(av, bv)
      else properties[k] = av ?? bv
    }
    const required = a.required.filter((k) => b.required.includes(k))
    return {
      type: 'object',
      properties,
      required,
      nullable: a.nullable || b.nullable,
    }
  }

  // Different shapes → union.
  return unionOf(a, b)
}

function withNullable(s: InferredSchema): InferredSchema {
  if (s.type === 'union') return s
  if (s.type === 'unknown' || s.type === 'null') return s
  return { ...s, nullable: true } as InferredSchema
}

function unionOf(a: InferredSchema, b: InferredSchema): InferredSchema {
  const flat: InferredSchema[] = []
  if (a.type === 'union') flat.push(...a.anyOf)
  else flat.push(a)
  if (b.type === 'union') flat.push(...b.anyOf)
  else flat.push(b)
  return { type: 'union', anyOf: flat }
}

// Drift = type families differ at any leaf. Adding optional properties or
// widening "integer → number" doesn't count.
export type DriftPath = { path: string; before: string; after: string }

export function detectDrift(prev: InferredSchema, next: InferredSchema): DriftPath[] {
  const drifts: DriftPath[] = []
  walk(prev, next, '$', drifts)
  return drifts
}

function walk(a: InferredSchema, b: InferredSchema, path: string, out: DriftPath[]): void {
  if (a.type === 'unknown' || b.type === 'unknown') return
  if (a.type === 'null' || b.type === 'null') return
  if (a.type === b.type) {
    if (a.type === 'object' && b.type === 'object') {
      for (const k of Object.keys(a.properties)) {
        if (b.properties[k]) walk(a.properties[k], b.properties[k], `${path}.${k}`, out)
      }
    }
    if (a.type === 'array' && b.type === 'array') walk(a.items, b.items, `${path}[*]`, out)
    return
  }
  // Acceptable widening: number/number with different integer flags handled above.
  out.push({ path, before: a.type, after: b.type })
}
