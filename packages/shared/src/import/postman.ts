// packages/shared/src/import/postman.ts
// Imports a Postman Collection v2.1 export and produces a ProjectBundle.
// No external dependencies — pure TypeScript.

import type { ProjectBundle, Scenario, BlockDefData, BlockInstance, Environment } from '../runtime/bundle.js'

// ---------------------------------------------------------------------------
// Postman Collection v2.1 types (minimal, only what we need)
// ---------------------------------------------------------------------------

interface PostmanVariable {
  key: string
  value?: string
  type?: string
}

interface PostmanUrl {
  raw?: string
  host?: string[]
  path?: string[]
  query?: Array<{ key: string; value?: string; disabled?: boolean }>
  variable?: PostmanVariable[]
  protocol?: string
}

interface PostmanHeader {
  key: string
  value: string
  disabled?: boolean
}

interface PostmanBody {
  mode?: 'raw' | 'formdata' | 'urlencoded' | 'file' | 'graphql'
  raw?: string
  options?: { raw?: { language?: string } }
  formdata?: Array<{ key: string; value?: string; type?: 'text' | 'file'; disabled?: boolean }>
  urlencoded?: Array<{ key: string; value?: string; disabled?: boolean }>
}

interface PostmanRequest {
  method?: string
  url?: string | PostmanUrl
  header?: PostmanHeader[]
  body?: PostmanBody
  description?: string
}

interface PostmanItem {
  id?: string
  name: string
  request?: PostmanRequest
  item?: PostmanItem[]     // folder
  description?: string
}

interface PostmanCollection {
  info?: {
    name?: string
    schema?: string
    description?: string
  }
  item?: PostmanItem[]
  variable?: PostmanVariable[]
}

interface PostmanEnvironment {
  name?: string
  values?: Array<{ key: string; value?: string; enabled?: boolean; type?: string }>
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isRecord(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val)
}

function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
}

function uid(): string {
  // Deterministic-ish uid using Math.random — sufficient for import use-case
  return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10)
}

function normalizeMethod(m: string | undefined): 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' {
  const upper = (m ?? 'GET').toUpperCase()
  if (upper === 'GET') return 'GET'
  if (upper === 'POST') return 'POST'
  if (upper === 'PUT') return 'PUT'
  if (upper === 'DELETE') return 'DELETE'
  if (upper === 'PATCH') return 'PATCH'
  // Fallback non-standard methods to POST
  return 'POST'
}

/** Resolve a Postman URL object or string into a template string.
 *  Postman variables {{var}} are preserved as-is. */
function resolveUrl(url: string | PostmanUrl | undefined): string {
  if (!url) return ''
  if (typeof url === 'string') return url

  // Reconstruct from parts, preserving Postman {{var}} syntax
  const protocol = url.protocol ?? 'https'
  const host = Array.isArray(url.host) ? url.host.join('.') : ''
  const path = Array.isArray(url.path) ? '/' + url.path.join('/') : ''

  let base = url.raw ?? `${protocol}://${host}${path}`

  // Append non-disabled query params
  if (Array.isArray(url.query)) {
    const params = url.query
      .filter((q) => !q.disabled && q.key)
      .map((q) => `${q.key}=${q.value ?? ''}`)
    if (params.length > 0) {
      base = base.includes('?') ? `${base}&${params.join('&')}` : `${base}?${params.join('&')}`
    }
  }

  return base
}

/** Convert Postman request body to a BlockDefData request shape. */
function resolveBody(body: PostmanBody | undefined): {
  bodyTemplate?: unknown
  extraInputs?: Array<{ name: string; label: string; type: 'string' | 'json'; location: 'body' }>
} {
  if (!body) return {}

  if (body.mode === 'raw' && body.raw !== undefined) {
    const lang = body.options?.raw?.language ?? 'text'
    if (lang === 'json') {
      let parsed: unknown
      try {
        parsed = JSON.parse(body.raw)
      } catch {
        parsed = body.raw
      }
      return { bodyTemplate: parsed }
    }
    // Plain text / other raw modes: keep as string template
    return { bodyTemplate: body.raw }
  }

  if (body.mode === 'formdata' && Array.isArray(body.formdata)) {
    // Represent each form field as an input; body as a special "formdata" marker
    const inputs = body.formdata
      .filter((f) => !f.disabled && f.type !== 'file')
      .map((f) => ({
        name: f.key,
        label: f.key,
        type: 'string' as const,
        location: 'body' as const,
      }))
    return { extraInputs: inputs }
  }

  if (body.mode === 'urlencoded' && Array.isArray(body.urlencoded)) {
    const inputs = body.urlencoded
      .filter((f) => !f.disabled)
      .map((f) => ({
        name: f.key,
        label: f.key,
        type: 'string' as const,
        location: 'body' as const,
      }))
    return { extraInputs: inputs }
  }

  return {}
}

// ---------------------------------------------------------------------------
// Item → BlockDefData
// ---------------------------------------------------------------------------

function itemToBlock(item: PostmanItem): BlockDefData | null {
  const req = item.request
  if (!req) return null

  const method = normalizeMethod(req.method)
  const urlTemplate = resolveUrl(req.url)
  if (!urlTemplate) return null

  const kind = slugify(item.name) || slugify(urlTemplate)

  // Headers (skip disabled and Authorization — that's handled by auth field)
  const headers: Record<string, string> = {}
  if (Array.isArray(req.header)) {
    for (const h of req.header) {
      if (!h.disabled && h.key && h.key.toLowerCase() !== 'authorization') {
        headers[h.key] = h.value
      }
    }
  }

  // Detect auth from Authorization header
  let auth: 'none' | 'jwt' | 'cookie-or-jwt' = 'none'
  if (Array.isArray(req.header)) {
    const authHeader = req.header.find(
      (h) => !h.disabled && h.key.toLowerCase() === 'authorization'
    )
    if (authHeader) {
      auth = 'jwt'
    }
  }

  // Body
  const { bodyTemplate, extraInputs } = resolveBody(req.body)

  const inputs = [...(extraInputs ?? [])]

  // If there is a raw JSON body, expose it as a json input so the user can override it
  if (bodyTemplate !== undefined && (!extraInputs || extraInputs.length === 0)) {
    inputs.push({
      name: 'body',
      label: 'Request Body',
      type: 'json',
      location: 'body',
    })
  }

  const request: BlockDefData['request'] = {
    method,
    urlTemplate,
    ...(Object.keys(headers).length > 0 ? { headers } : {}),
    ...(bodyTemplate !== undefined ? { bodyTemplate } : {}),
  }

  return {
    kind,
    label: item.name,
    auth,
    inputs,
    outputs: [
      { jsonPath: 'data', contextKey: 'lastResponse' },
      { jsonPath: 'status', contextKey: 'lastStatus' },
    ],
    request,
  }
}

// ---------------------------------------------------------------------------
// Folder → Scenario (with flattened path name)
// ---------------------------------------------------------------------------

interface FlatRequest {
  folderPath: string   // e.g. "Auth / Login" or "" for top-level
  item: PostmanItem
}

function flattenItems(items: PostmanItem[], folderPath: string, acc: FlatRequest[]): void {
  for (const item of items) {
    if (Array.isArray(item.item)) {
      // It's a folder — recurse with updated path
      const childPath = folderPath ? `${folderPath} / ${item.name}` : item.name
      flattenItems(item.item, childPath, acc)
    } else {
      // It's a request item
      acc.push({ folderPath, item })
    }
  }
}

function buildScenarios(items: PostmanItem[], blocks: BlockDefData[]): Scenario[] {
  const flat: FlatRequest[] = []
  flattenItems(items, '', flat)

  // Group by folder path
  const groups = new Map<string, PostmanItem[]>()
  for (const { folderPath, item } of flat) {
    const key = folderPath || '__top_level__'
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(item)
  }

  const scenarios: Scenario[] = []

  for (const [folderName, groupItems] of groups) {
    const scenarioName = folderName === '__top_level__' ? 'Imported Requests' : folderName
    const blockInstances: BlockInstance[] = []

    for (const item of groupItems) {
      const block = itemToBlock(item)
      if (!block) continue

      // Ensure the block is registered (dedup by kind)
      if (!blocks.find((b) => b.kind === block.kind)) {
        blocks.push(block)
      }

      blockInstances.push({
        id: uid(),
        kind: block.kind,
        overrides: {},
      })
    }

    if (blockInstances.length > 0) {
      scenarios.push({
        id: uid(),
        name: scenarioName,
        createdAt: new Date().toISOString(),
        blocks: blockInstances,
      })
    }
  }

  return scenarios
}

// ---------------------------------------------------------------------------
// Environment import
// ---------------------------------------------------------------------------

function buildEnvironment(env: PostmanEnvironment): Environment {
  const headers: Record<string, string> = {}
  // Collect non-secret variables as headers/context (secrets are placeholder)
  if (Array.isArray(env.values)) {
    for (const v of env.values) {
      if (v.enabled !== false && v.key && v.type !== 'secret') {
        headers[v.key] = v.value ?? ''
      }
    }
  }

  return {
    id: uid(),
    name: env.name ?? 'Postman Environment',
    baseUrl: headers['baseUrl'] ?? headers['base_url'] ?? headers['BASE_URL'] ?? '',
    auth: { kind: 'none' },
    headers,
    createdAt: new Date().toISOString(),
  }
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Import a Postman Collection v2.1 JSON export into a ProjectBundle.
 *
 * @param collectionJson - parsed JSON of the Postman collection export
 * @param environmentJson - optional parsed JSON of a Postman environment export
 * @returns ProjectBundle
 */
export function importPostman(
  collectionJson: unknown,
  environmentJson?: unknown
): ProjectBundle {
  if (!isRecord(collectionJson)) {
    throw new Error('Invalid Postman collection: expected a JSON object')
  }

  const collection = collectionJson as PostmanCollection

  // Validate rough schema
  const schemaUrl = (collection.info?.schema ?? '').toLowerCase()
  if (schemaUrl && !schemaUrl.includes('v2.1') && !schemaUrl.includes('v2_1') && !schemaUrl.includes('collection/v2')) {
    // Best-effort warning — don't throw, attempt import anyway
  }

  const collectionName = collection.info?.name ?? 'Postman Import'
  const items = collection.item ?? []

  // Collection-level variables (e.g. {{baseUrl}}) are preserved as-is in URL templates
  // They are listed here for reference but not transformed.
  // const collectionVars = collection.variable ?? []

  // Build blocks list (mutated by buildScenarios)
  const blocks: BlockDefData[] = []
  const scenarios = buildScenarios(items, blocks)

  // Environments
  const environments: Environment[] = []
  if (environmentJson && isRecord(environmentJson)) {
    environments.push(buildEnvironment(environmentJson as PostmanEnvironment))
  }

  const now = new Date().toISOString()

  const bundle: ProjectBundle = {
    id: slugify(collectionName) || 'postman-import',
    name: collectionName,
    description: collection.info?.description,
    createdAt: now,
    versions: [
      {
        version: '1.0.0',
        releasedAt: now,
        releaseNotes: `Imported from Postman collection: ${collectionName}`,
        changes: [
          {
            type: 'added',
            summary: `Imported ${blocks.length} block${blocks.length !== 1 ? 's' : ''} from Postman collection`,
          },
        ],
        blocks,
        scenarios,
        environments,
        docs: {},
      },
    ],
  }

  return bundle
}
