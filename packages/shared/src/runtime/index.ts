// packages/shared/src/runtime/index.ts
// DOM-free portable runtime. Uses an injectable Fetcher so it works in Node,
// browsers, and test environments equally.

import type {
  BlockDefData,
  BlockInstance,
  Scenario,
  Environment,
} from './bundle.js'
import { ProjectBundleSchema } from './bundle.js'

export type {
  ProjectBundle,
  ProjectVersion,
  BlockDefData,
  BlockInstance,
  Scenario,
  Environment,
  AuthConfig,
  FieldSpec,
  OutputSpec,
  AuthMode,
} from './bundle.js'

export { ProjectBundleSchema } from './bundle.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RuntimeContext = Record<string, unknown>

export type BlockRunResult =
  | {
      status: 'ok'
      httpStatus: number
      elapsedMs: number
      response: unknown
      captured: Record<string, unknown>
      subResults?: BlockRunResult[]
    }
  | {
      status: 'err'
      httpStatus?: number
      elapsedMs: number
      response: unknown
      error: string
      subResults?: BlockRunResult[]
    }

/**
 * Injectable fetch abstraction — same shape as the platform `fetch` but typed.
 * Pass `fetch` in Node 18+, or a stub in tests.
 */
export type Fetcher = (
  url: string,
  init: {
    method: string
    headers: Record<string, string>
    body?: string
    credentials?: string
  },
) => Promise<{
  status: number
  headers: { get(name: string): string | null }
  text(): Promise<string>
}>

// ---------------------------------------------------------------------------
// Token substitution (inline copy — avoids DOM dependency)
// ---------------------------------------------------------------------------

const WHOLE_TOKEN_RE = /^\{\{([^}]+)\}\}$/
const INLINE_TOKEN_RE = /\{\{([^}]+)\}\}/g

function substituteTemplate(template: unknown, values: Record<string, unknown>): unknown {
  if (typeof template === 'string') {
    const wholeMatch = WHOLE_TOKEN_RE.exec(template)
    if (wholeMatch) return values[wholeMatch[1]]
    return template.replace(INLINE_TOKEN_RE, (_full, name: string) =>
      String(values[name] ?? ''),
    )
  }
  if (Array.isArray(template)) {
    const result: unknown[] = []
    for (const item of template) {
      const sub = substituteTemplate(item, values)
      if (sub !== undefined) result.push(sub)
    }
    return result
  }
  if (template !== null && typeof template === 'object') {
    const result: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(template as Record<string, unknown>)) {
      const sub = substituteTemplate(v, values)
      if (sub !== undefined) result[k] = sub
    }
    return result
  }
  return template
}

// ---------------------------------------------------------------------------
// captureOutputs
// ---------------------------------------------------------------------------

function getByPath(obj: unknown, path: string): unknown {
  if (path === '$') return obj
  const parts = path
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .filter(Boolean)
  let cur: unknown = obj
  for (const p of parts) {
    if (cur == null) return undefined
    cur = (cur as Record<string, unknown>)[p]
  }
  return cur
}

function captureOutputs(
  response: unknown,
  outputs: Array<{ jsonPath: string; contextKey: string }>,
): Record<string, unknown> {
  const captured: Record<string, unknown> = {}
  for (const o of outputs) {
    const v = getByPath(response, o.jsonPath)
    if (v !== undefined) captured[o.contextKey] = v
  }
  return captured
}

// ---------------------------------------------------------------------------
// buildRequest — resolves tokens in a BlockDefData to a concrete HTTP call
// ---------------------------------------------------------------------------

const TOKEN_PATTERN = '\\{\\{([^}]+)\\}\\}'

function buildRequest(
  data: BlockDefData,
  values: Record<string, unknown>,
  baseUrl: string,
): { method: string; url: string; headers: Record<string, string>; body?: unknown } {
  // Merge query into urlTemplate (legacy compat)
  let mergedUrl = data.request.urlTemplate
  if (data.request.query && Object.keys(data.request.query).length > 0) {
    const queryStr = Object.entries(data.request.query)
      .map(([k, v]) => {
        const isToken = new RegExp(`^${TOKEN_PATTERN}$`).test(v)
        return `${encodeURIComponent(k)}=${isToken ? v : encodeURIComponent(v)}`
      })
      .join('&')
    const sep = mergedUrl.includes('?') ? '&' : '?'
    mergedUrl = mergedUrl + sep + queryStr
  }

  // 1. Path
  const pathPart = mergedUrl.split('?')[0]
  const resolvedPath = substituteTemplate(pathPart, values) as string
  let url = `${baseUrl}${resolvedPath}`

  // 2. Query params
  const qIdx = mergedUrl.indexOf('?')
  if (qIdx !== -1) {
    const queryPart = mergedUrl.slice(qIdx + 1)
    const params: string[] = []
    for (const part of queryPart.split('&')) {
      const eqIdx = part.indexOf('=')
      if (eqIdx === -1) continue
      const key = part.slice(0, eqIdx)
      const rawValue = part.slice(eqIdx + 1)
      if (!key) continue
      const tokenMatch = new RegExp(`^${TOKEN_PATTERN}$`).exec(rawValue)
      let resolved: unknown
      if (tokenMatch) {
        resolved = values[tokenMatch[1]]
      } else {
        resolved = rawValue
      }
      if (resolved === undefined || resolved === '') continue
      params.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(resolved))}`)
    }
    if (params.length > 0) url = `${url}?${params.join('&')}`
  }

  // 3. Headers
  const headers: Record<string, string> = {}
  if (data.request.headers) {
    for (const [k, tpl] of Object.entries(data.request.headers)) {
      const resolved = substituteTemplate(tpl, values)
      if (resolved === undefined || resolved === '') continue
      headers[k] = String(resolved)
    }
  }

  // 4. Body
  if (data.request.bodyTemplate === undefined) {
    return { method: data.request.method, url, headers }
  }
  const body = substituteTemplate(data.request.bodyTemplate, values)
  if (body === undefined) return { method: data.request.method, url, headers }
  return { method: data.request.method, url, headers, body }
}

// ---------------------------------------------------------------------------
// resolveInputs
// ---------------------------------------------------------------------------

function resolveInputs(
  def: BlockDefData,
  inst: { overrides: Record<string, unknown> },
  ctx: RuntimeContext,
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

// ---------------------------------------------------------------------------
// runBlockData — runs a single BlockDefData instance
// ---------------------------------------------------------------------------

async function runBlockData(
  def: BlockDefData,
  inst: { overrides: Record<string, unknown> },
  ctx: RuntimeContext,
  env: Environment | null | undefined,
  fetcher: Fetcher,
): Promise<BlockRunResult> {
  const started = Date.now()
  try {
    const values = resolveInputs(def, inst, ctx)
    const baseUrl = env?.baseUrl ?? ''
    const req = buildRequest(def, values, baseUrl)

    // Auth injection
    const headers: Record<string, string> = { ...req.headers }
    let url = req.url

    if (def.auth !== 'none' && env?.auth) {
      const envAuth = env.auth
      switch (envAuth.kind) {
        case 'bearer':
          if (!ctx['jwt']) headers['Authorization'] = `Bearer ${envAuth.token}`
          break
        case 'cookie':
          if (envAuth.token && !ctx['jwt'])
            headers['Authorization'] = `Bearer ${envAuth.token}`
          break
        case 'apiKey':
          if (envAuth.in === 'header') {
            headers[envAuth.name] = envAuth.value
          } else {
            const sep = url.includes('?') ? '&' : '?'
            url = `${url}${sep}${encodeURIComponent(envAuth.name)}=${encodeURIComponent(envAuth.value)}`
          }
          break
        case 'basic':
          headers['Authorization'] = `Basic ${Buffer.from(
            `${envAuth.username}:${envAuth.password}`,
          ).toString('base64')}`
          break
        case 'none':
          break
      }
    }

    if ((def.auth === 'jwt' || def.auth === 'cookie-or-jwt') && ctx['jwt']) {
      headers['Authorization'] = `Bearer ${String(ctx['jwt'])}`
    }

    // Merge env-level headers (lower priority than block headers)
    const finalHeaders: Record<string, string> = {
      ...(env?.headers ?? {}),
      ...headers,
    }

    if (req.body !== undefined && !finalHeaders['content-type'] && !finalHeaders['Content-Type']) {
      finalHeaders['content-type'] = 'application/json'
    }

    const fetchInit: Parameters<Fetcher>[1] = {
      method: req.method,
      headers: finalHeaders,
      credentials: 'include',
    }
    if (req.body !== undefined) {
      fetchInit.body =
        typeof req.body === 'string' ? req.body : JSON.stringify(req.body)
    }

    const res = await fetcher(url, fetchInit)
    const elapsedMs = Date.now() - started

    const text = await res.text()
    let body: unknown = text
    const ct = res.headers.get('content-type') ?? ''
    if (ct.includes('application/json')) {
      try {
        body = JSON.parse(text)
      } catch {
        body = text
      }
    }

    if (res.status >= 200 && res.status < 300) {
      return {
        status: 'ok',
        httpStatus: res.status,
        elapsedMs,
        response: body,
        captured: captureOutputs(body, def.outputs),
      }
    }
    return {
      status: 'err',
      httpStatus: res.status,
      elapsedMs,
      response: body,
      error: `HTTP ${res.status}`,
    }
  } catch (e) {
    return {
      status: 'err',
      elapsedMs: Date.now() - started,
      response: null,
      error: (e as Error).message,
    }
  }
}

// ---------------------------------------------------------------------------
// runScenarioFrom — the public API
// ---------------------------------------------------------------------------

/**
 * Run blocks from `startIdx` onwards.
 *
 * @param blocks       Ordered block instances from a Scenario
 * @param startIdx     Index to start from (usually 0)
 * @param initialCtx   Initial runtime context (e.g. {})
 * @param onResult     Callback fired after each block; receives updated ctx, block index, and result
 * @param env          Active environment (provides baseUrl + auth)
 * @param registry     Map from block kind to BlockDefData; built from bundle.versions[v].blocks
 * @param fetcher      Injectable HTTP client (pass globalThis.fetch or a stub)
 * @param scenarioLookup  Optional function to resolve scenario IDs (for scenario-ref blocks)
 */
export async function runScenarioFrom(
  blocks: BlockInstance[],
  startIdx: number,
  initialCtx: RuntimeContext,
  onResult: (ctx: RuntimeContext, idx: number, result: BlockRunResult) => void,
  env?: Environment | null,
  registry?: Record<string, BlockDefData>,
  fetcher?: Fetcher,
  _scenarioLookup?: (id: string) => Scenario | null,
): Promise<void> {
  const reg = registry ?? {}
  const fetch_ = fetcher ?? (globalThis.fetch as unknown as Fetcher)

  let ctx = initialCtx
  for (let i = startIdx; i < blocks.length; i++) {
    const inst = blocks[i]
    const def = reg[inst.kind]
    if (!def) {
      const result: BlockRunResult = {
        status: 'err',
        elapsedMs: 0,
        response: null,
        error: `Unknown block kind: ${inst.kind}`,
      }
      onResult(ctx, i, result)
      return
    }

    const result = await runBlockData(def, inst, ctx, env, fetch_)
    if (result.status === 'ok') {
      ctx = { ...ctx, ...result.captured }
    }
    onResult(ctx, i, result)
    if (result.status === 'err') return
  }
}

// ---------------------------------------------------------------------------
// Helpers for bundle consumers
// ---------------------------------------------------------------------------

/**
 * Parse and validate a raw JSON object as a ProjectBundle.
 * Throws a ZodError if invalid.
 */
export function parseBundle(raw: unknown) {
  return ProjectBundleSchema.parse(raw)
}

/**
 * Sort versions by semver descending and return the highest version string.
 */
export function resolveActiveVersion(versions: Array<{ version: string }>): string {
  const sorted = [...versions].sort((a, b) => compareSemver(b.version, a.version))
  return sorted[0]?.version ?? ''
}

function compareSemver(a: string, b: string): number {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}

/**
 * Build a block kind to BlockDefData registry from an array of BlockDefData.
 */
export function buildRegistry(blocks: BlockDefData[]): Record<string, BlockDefData> {
  const reg: Record<string, BlockDefData> = {}
  for (const b of blocks) reg[b.kind] = b
  return reg
}
