// src/blocks/parseCurl.ts

export function parseCurl(
  raw: string
): { method: string; url: string; headers: Record<string, string>; body?: string } | null {
  // Normalize line continuations
  const normalized = raw.replace(/\\\n/g, ' ').trim()

  // Extract method from -X or --request
  const methodMatch = normalized.match(/(?:-X|--request)\s+([A-Z]+)/)
  let method = methodMatch ? methodMatch[1]! : ''

  // Extract URL: first token starting with http (quoted or unquoted)
  const urlMatch =
    normalized.match(/(?:^|\s)(["'])(https?:\/\/[^"']+)\1/) ||
    normalized.match(/(?:^|\s)(https?:\/\/\S+)/)
  const url = urlMatch ? (urlMatch[2] ?? urlMatch[1]!) : null
  if (!url) return null

  // Extract headers
  const headers: Record<string, string> = {}
  const headerRe = /(?:-H|--header)\s+(?:"([^"]+)"|'([^']+)')/g
  let hm: RegExpExecArray | null
  while ((hm = headerRe.exec(normalized)) !== null) {
    const header = hm[1] ?? hm[2] ?? ''
    const colonIdx = header.indexOf(':')
    if (colonIdx !== -1) {
      const key = header.slice(0, colonIdx).trim()
      const value = header.slice(colonIdx + 1).trim()
      headers[key] = value
    }
  }

  // Extract body
  const bodyMatch = normalized.match(
    /(?:-d|--data(?:-raw)?)\s+(?:"((?:[^"\\]|\\.)*)"|'([^']*)')/
  )
  const body = bodyMatch ? (bodyMatch[1] ?? bodyMatch[2]) : undefined

  // Default method
  if (!method) {
    method = body !== undefined ? 'POST' : 'GET'
  }

  return { method, url, headers, body }
}
