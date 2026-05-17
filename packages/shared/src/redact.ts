export const SECRET_KEY_PATTERN: RegExp =
  /(authorization|cookie|api[-_]?key|x-api-key|token|secret|password|bearer)/i

export type RedactOptions = {
  pattern?: RegExp
  replacement?: string
  extraKeys?: string[]
}

const DEFAULT_REPLACEMENT = '***'

// Cap recursion to avoid pathological cycles and stack overflow on adversarial input.
const MAX_DEPTH = 16

function resolvePattern(opts?: RedactOptions): RegExp {
  const base = opts?.pattern ?? SECRET_KEY_PATTERN
  if (!opts?.extraKeys || opts.extraKeys.length === 0) return base
  const escaped = opts.extraKeys.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const flags = base.flags.includes('i') ? base.flags : base.flags + 'i'
  return new RegExp(`${base.source}|${escaped.join('|')}`, flags)
}

function resolveReplacement(opts?: RedactOptions): string {
  return opts?.replacement ?? DEFAULT_REPLACEMENT
}

export function redactString(s: string, _replacement: string = DEFAULT_REPLACEMENT): string {
  return s
}

export function redactHeaders(
  headers: Record<string, string | string[]>,
  opts?: RedactOptions,
): Record<string, string | string[]> {
  const pattern = resolvePattern(opts)
  const replacement = resolveReplacement(opts)
  const out: Record<string, string | string[]> = {}
  for (const [key, value] of Object.entries(headers)) {
    if (pattern.test(key)) {
      out[key] = Array.isArray(value) ? value.map(() => replacement) : replacement
    } else {
      out[key] = Array.isArray(value) ? [...value] : value
    }
  }
  return out
}

export function redactQueryString(url: string, opts?: RedactOptions): string {
  const pattern = resolvePattern(opts)
  const replacement = resolveReplacement(opts)
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    // Relative URLs: parse against a placeholder base, then strip it.
    const base = 'http://__redact_placeholder__'
    try {
      parsed = new URL(url, base)
    } catch {
      return url
    }
    const params = parsed.searchParams
    for (const key of [...params.keys()]) {
      if (pattern.test(key)) {
        const values = params.getAll(key)
        params.delete(key)
        for (const _ of values) params.append(key, replacement)
      }
    }
    const path = parsed.pathname + (parsed.search ? parsed.search : '') + parsed.hash
    return path
  }
  const params = parsed.searchParams
  for (const key of [...params.keys()]) {
    if (pattern.test(key)) {
      const values = params.getAll(key)
      params.delete(key)
      for (const _ of values) params.append(key, replacement)
    }
  }
  return parsed.toString()
}

function redactValue(value: unknown, pattern: RegExp, replacement: string, depth: number): unknown {
  if (depth > MAX_DEPTH) return value
  if (value === null || value === undefined) return value
  if (Array.isArray(value)) {
    return value.map((v) => redactValue(v, pattern, replacement, depth + 1))
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (pattern.test(k)) {
        out[k] = replacement
      } else {
        out[k] = redactValue(v, pattern, replacement, depth + 1)
      }
    }
    return out
  }
  return value
}

export function redactObject<T>(value: T, opts?: RedactOptions): T {
  const pattern = resolvePattern(opts)
  const replacement = resolveReplacement(opts)
  return redactValue(value, pattern, replacement, 0) as T
}

// Loose structural types — the canonical types live in apps/web. Keeping these
// loose lets the helper be consumed from server, CLI, and web without import cycles.
export type RedactableAuthConfig =
  | { kind: 'bearer'; token: string }
  | { kind: 'cookie'; token?: string }
  | { kind: 'apiKey'; in: 'header' | 'query'; name: string; value: string }
  | { kind: 'basic'; username: string; password: string }
  | { kind: 'none' }

export type RedactableEnvironment = {
  id: string
  name: string
  baseUrl: string
  auth: RedactableAuthConfig
  headers: Record<string, string>
  createdAt: string
}

export function redactEnvironment<E extends RedactableEnvironment>(env: E, opts?: RedactOptions): E {
  const replacement = resolveReplacement(opts)
  const headers = redactHeaders(env.headers, opts) as Record<string, string>
  let auth: RedactableAuthConfig
  switch (env.auth.kind) {
    case 'bearer':
      auth = { kind: 'bearer', token: replacement }
      break
    case 'cookie':
      auth = { kind: 'cookie', token: env.auth.token === undefined ? undefined : replacement }
      break
    case 'apiKey':
      auth = { kind: 'apiKey', in: env.auth.in, name: env.auth.name, value: replacement }
      break
    case 'basic':
      auth = { kind: 'basic', username: env.auth.username, password: replacement }
      break
    case 'none':
      auth = { kind: 'none' }
      break
  }
  return { ...env, auth, headers } as E
}

export type RedactableResolvedRequest = {
  method: string
  url: string
  headers: Record<string, string>
  body?: unknown
}

export type RedactableRunResult = {
  status: 'ok' | 'err'
  httpStatus?: number
  elapsedMs: number
  response: unknown
  captured?: Record<string, unknown>
  error?: string
  request?: RedactableResolvedRequest
  subResults?: RedactableRunResult[]
}

export function redactRunResult<R extends RedactableRunResult>(result: R, opts?: RedactOptions): R {
  const request = result.request
    ? {
        ...result.request,
        url: redactQueryString(result.request.url, opts),
        headers: redactHeaders(result.request.headers, opts) as Record<string, string>,
        body: result.request.body === undefined ? undefined : redactObject(result.request.body, opts),
      }
    : undefined
  const response = redactObject(result.response, opts)
  const captured = result.captured ? (redactObject(result.captured, opts) as Record<string, unknown>) : undefined
  const subResults = result.subResults?.map((sr) => redactRunResult(sr, opts))
  const out = { ...result, response } as R
  if (request) (out as RedactableRunResult).request = request
  if (captured) (out as RedactableRunResult).captured = captured
  if (subResults) (out as RedactableRunResult).subResults = subResults
  return out
}

export type RedactableBundle = {
  id?: string
  name?: string
  versions?: Array<{
    environments?: RedactableEnvironment[]
    runHistory?: RedactableRunResult[]
    [k: string]: unknown
  }>
  environments?: RedactableEnvironment[]
  runHistory?: RedactableRunResult[]
  [k: string]: unknown
}

export function redactBundle<B extends RedactableBundle>(bundle: B, opts?: RedactOptions): B {
  const out: RedactableBundle = { ...bundle }
  if (Array.isArray(bundle.environments)) {
    out.environments = bundle.environments.map((e) => redactEnvironment(e, opts))
  }
  if (Array.isArray(bundle.runHistory)) {
    out.runHistory = bundle.runHistory.map((r) => redactRunResult(r, opts))
  }
  if (Array.isArray(bundle.versions)) {
    out.versions = bundle.versions.map((v) => {
      const nv: {
        environments?: RedactableEnvironment[]
        runHistory?: RedactableRunResult[]
        [k: string]: unknown
      } = { ...v }
      if (Array.isArray(v.environments)) {
        nv.environments = v.environments.map((e) => redactEnvironment(e, opts))
      }
      if (Array.isArray(v.runHistory)) {
        nv.runHistory = v.runHistory.map((r) => redactRunResult(r, opts))
      }
      return nv
    })
  }
  return out as B
}
