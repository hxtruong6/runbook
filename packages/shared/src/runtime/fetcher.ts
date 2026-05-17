import type {
  AuthConfig,
  Fetcher,
  HttpRequest,
  RunRequestOptions,
  RunRequestResult,
} from './types.js'
import { nowMs } from './timer.js'

function encodeBasic(username: string, password: string): string {
  const raw = `${username}:${password}`
  if (typeof btoa === 'function') return btoa(raw)
  // Node fallback — referenced via globalThis to avoid DOM/Node typing collisions.
  const g = globalThis as { Buffer?: { from(s: string, enc: string): { toString(enc: string): string } } }
  if (g.Buffer) return g.Buffer.from(raw, 'utf-8').toString('base64')
  throw new Error('No base64 encoder available')
}

export const defaultFetcher: Fetcher = async (
  req: HttpRequest,
  opts: RunRequestOptions
): Promise<RunRequestResult> => {
  const headers: Record<string, string> = {
    ...(opts.envHeaders ?? {}),
    ...req.headers,
  }

  let url = req.url

  if (opts.auth !== 'none' && opts.envAuth) {
    const envAuth: AuthConfig = opts.envAuth
    switch (envAuth.kind) {
      case 'bearer':
        if (!opts.jwt) {
          headers['Authorization'] = `Bearer ${envAuth.token}`
        }
        break
      case 'cookie':
        if (envAuth.token && !opts.jwt) {
          headers['Authorization'] = `Bearer ${envAuth.token}`
        }
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
        headers['Authorization'] = `Basic ${encodeBasic(envAuth.username, envAuth.password)}`
        break
      case 'none':
        break
    }
  }

  if ((opts.auth === 'jwt' || opts.auth === 'cookie-or-jwt') && opts.jwt) {
    headers['Authorization'] = `Bearer ${opts.jwt}`
  }

  if (req.body !== undefined && !headers['content-type'] && !headers['Content-Type']) {
    headers['content-type'] = 'application/json'
  }

  const init: RequestInit = {
    method: req.method,
    headers,
    credentials: 'include',
  }
  if (req.body !== undefined) {
    init.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body)
  }

  const started = nowMs()
  const res = await fetch(url, init)
  const elapsedMs = Math.round(nowMs() - started)

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

  return {
    httpStatus: res.status,
    body,
    elapsedMs,
    resolvedRequest: { method: req.method, url, headers, body: req.body },
  }
}
