// packages/shared/src/redact.ts
// Wave 1 redaction helpers — remove secrets before sharing run results.

// ─────────────────────────────────────────────────────────────
// Header / env-var patterns to strip
// ─────────────────────────────────────────────────────────────

const SENSITIVE_HEADER_PATTERNS = [
  /^authorization$/i,
  /^x-api-key$/i,
  /^x-auth-token$/i,
  /^cookie$/i,
  /^set-cookie$/i,
  /^proxy-authorization$/i,
]

const REDACTED = '[REDACTED]'

function isSensitiveHeader(name: string): boolean {
  return SENSITIVE_HEADER_PATTERNS.some((p) => p.test(name))
}

function redactHeaders(headers: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(headers)) {
    out[k] = isSensitiveHeader(k) ? REDACTED : v
  }
  return out
}

// ─────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────

export type RunResultLike = Record<string, unknown>
export type BundleLike = Record<string, unknown>
export type EnvironmentLike = {
  auth?: { kind: string; token?: string; password?: string; value?: string; username?: string }
  headers?: Record<string, string>
  [key: string]: unknown
}

/**
 * Strip sensitive data from a single BlockRunResult or scenario run result tree.
 * Removes Authorization / apiKey / token headers from `request.headers`.
 */
export function redactRunResult(result: RunResultLike): RunResultLike {
  const copy: RunResultLike = { ...result }

  // Redact request headers
  if (
    copy['request'] &&
    typeof copy['request'] === 'object' &&
    !Array.isArray(copy['request'])
  ) {
    const req = copy['request'] as Record<string, unknown>
    if (req['headers'] && typeof req['headers'] === 'object') {
      copy['request'] = {
        ...req,
        headers: redactHeaders(req['headers'] as Record<string, string>),
      }
    }
  }

  // Recurse into subResults
  if (Array.isArray(copy['subResults'])) {
    copy['subResults'] = (copy['subResults'] as RunResultLike[]).map(redactRunResult)
  }

  return copy
}

/**
 * Strip auth tokens/secrets from environment config before embedding in a share.
 */
export function redactEnvironment(env: EnvironmentLike): EnvironmentLike {
  const copy: EnvironmentLike = { ...env }

  if (copy['auth'] && typeof copy['auth'] === 'object') {
    const auth = { ...copy['auth'] } as Record<string, unknown>
    // Redact credential fields
    for (const field of ['token', 'password', 'value']) {
      if (field in auth && auth[field]) {
        auth[field] = REDACTED
      }
    }
    copy['auth'] = auth as EnvironmentLike['auth']
  }

  if (copy['headers'] && typeof copy['headers'] === 'object') {
    copy['headers'] = redactHeaders(copy['headers'] as Record<string, string>)
  }

  return copy
}

/**
 * Strip secrets from a ProjectBundle before sharing:
 * - environment auth tokens in every version
 * - any header values matching sensitive patterns
 */
export function redactBundle(bundle: BundleLike): BundleLike {
  const copy: BundleLike = { ...bundle }

  if (Array.isArray(copy['versions'])) {
    copy['versions'] = (copy['versions'] as Record<string, unknown>[]).map((version) => {
      const v = { ...version }
      if (Array.isArray(v['environments'])) {
        v['environments'] = (v['environments'] as EnvironmentLike[]).map(redactEnvironment)
      }
      return v
    })
  }

  return copy
}
