import type { BlockDef, FieldSpec, HttpRequest } from './types.js'
import type { BlockDefData } from './bundle.js'

const TOKEN_PATTERN = '\\{\\{([^}]+)\\}\\}'
const WHOLE_TOKEN_RE = /^\{\{([^}]+)\}\}$/
const INLINE_TOKEN_RE = /\{\{([^}]+)\}\}/g

function parsePathTokens(urlTemplate: string): string[] {
  const path = urlTemplate.split('?')[0]
  const tokens: string[] = []
  const re = new RegExp(TOKEN_PATTERN, 'g')
  let match: RegExpExecArray | null
  while ((match = re.exec(path)) !== null) {
    if (!tokens.includes(match[1])) tokens.push(match[1])
  }
  return tokens
}

function parseQueryEntries(urlTemplate: string): Array<{ key: string; token: string }> {
  const qIdx = urlTemplate.indexOf('?')
  const queryPart = qIdx === -1 ? '' : urlTemplate.slice(qIdx + 1)
  if (!queryPart) return []
  const entries: Array<{ key: string; token: string }> = []
  for (const part of queryPart.split('&')) {
    const eqIdx = part.indexOf('=')
    if (eqIdx === -1) continue
    const key = part.slice(0, eqIdx)
    const value = part.slice(eqIdx + 1)
    const tokenMatch = /^\{\{([^}]+)\}\}$/.exec(value)
    if (tokenMatch && key) entries.push({ key, token: tokenMatch[1] })
  }
  return entries
}

function collectTokens(value: unknown, out: string[], visited = new WeakSet()): void {
  if (typeof value === 'string') {
    const re = new RegExp(TOKEN_PATTERN, 'g')
    let match: RegExpExecArray | null
    while ((match = re.exec(value)) !== null) {
      if (!out.includes(match[1])) out.push(match[1])
    }
  } else if (Array.isArray(value)) {
    if (visited.has(value)) return
    visited.add(value)
    for (const item of value) collectTokens(item, out, visited)
  } else if (value !== null && typeof value === 'object') {
    if (visited.has(value as object)) return
    visited.add(value as object)
    for (const v of Object.values(value as Record<string, unknown>)) collectTokens(v, out, visited)
  }
}

function parseBodyTokens(bodyTemplate: unknown): string[] {
  const tokens: string[] = []
  collectTokens(bodyTemplate, tokens)
  return tokens
}

export function substituteTemplate(
  template: unknown,
  values: Record<string, unknown>
): unknown {
  if (typeof template === 'string') {
    const wholeMatch = WHOLE_TOKEN_RE.exec(template)
    if (wholeMatch) return values[wholeMatch[1]]
    return template.replace(INLINE_TOKEN_RE, (_full, name: string) =>
      String(values[name] ?? '')
    )
  }
  if (Array.isArray(template)) {
    const result: unknown[] = []
    for (const item of template) {
      const s = substituteTemplate(item, values)
      if (s !== undefined) result.push(s)
    }
    return result
  }
  if (template !== null && typeof template === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(template as Record<string, unknown>)) {
      const s = substituteTemplate(val, values)
      if (s !== undefined) result[key] = s
    }
    return result
  }
  return template
}

export function dataDefToBlockDef(
  data: BlockDefData,
  opts: { resolveBaseUrl: () => string }
): BlockDef {
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

  const pathSet = new Set(parsePathTokens(mergedUrl))
  const querySet = new Set(parseQueryEntries(mergedUrl).map((e) => e.token))
  const bodySet = new Set(
    data.request.bodyTemplate ? parseBodyTokens(data.request.bodyTemplate) : []
  )

  const inputs: FieldSpec[] = data.inputs.map((inp) => ({
    ...inp,
    location:
      inp.location ??
      (pathSet.has(inp.name)
        ? 'path'
        : querySet.has(inp.name)
        ? 'query'
        : bodySet.has(inp.name)
        ? 'body'
        : undefined),
  }))

  function build(values: Record<string, unknown>): HttpRequest {
    const pathPart = mergedUrl.split('?')[0]
    const resolvedPath = substituteTemplate(pathPart, values) as string
    let url = `${opts.resolveBaseUrl()}${resolvedPath}`

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
        if (tokenMatch) resolved = values[tokenMatch[1]]
        else resolved = rawValue
        if (resolved === undefined || resolved === '') continue
        params.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(resolved))}`)
      }
      if (params.length > 0) url = `${url}?${params.join('&')}`
    }

    const headers: Record<string, string> = {}
    if (data.request.headers) {
      for (const [key, tpl] of Object.entries(data.request.headers)) {
        const resolved = substituteTemplate(tpl, values)
        if (resolved === undefined || resolved === '') continue
        headers[key] = String(resolved)
      }
    }

    if (data.request.bodyTemplate === undefined) {
      return { method: data.request.method, url, headers }
    }
    const body = substituteTemplate(data.request.bodyTemplate, values)
    if (body === undefined) {
      return { method: data.request.method, url, headers }
    }
    return { method: data.request.method, url, headers, body }
  }

  return {
    kind: data.kind,
    label: data.label,
    auth: data.auth,
    inputs,
    outputs: data.outputs,
    urlTemplate: mergedUrl,
    method: data.request.method,
    build,
  }
}

export function buildRegistryFromData(
  dataDefs: BlockDefData[],
  resolveBaseUrl: () => string
): Record<string, BlockDef> {
  const registry: Record<string, BlockDef> = {}
  for (const d of dataDefs) {
    registry[d.kind] = dataDefToBlockDef(d, { resolveBaseUrl })
  }
  return registry
}
