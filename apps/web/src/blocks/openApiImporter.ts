// src/blocks/openApiImporter.ts
// Pure utility — no React, no external parsing libraries.
// Parses an OpenAPI 3.x document object and produces ImportedBlock[].

import type { BlockDefData } from './dataBlock'

export type ImportedBlock = BlockDefData & { _selected: boolean }

// Local field spec type that matches BlockDefData's zod schema (mutable arrays)
type LocalFieldSpec = {
  name: string
  label: string
  type: 'string' | 'password' | 'number' | 'enum' | 'json'
  required?: boolean
  fromContextKey?: string
  enumValues?: string[]
  placeholder?: string
  location?: 'path' | 'query' | 'body' | 'header'
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function isRecord(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val)
}

function getString(obj: Record<string, unknown>, key: string): string | undefined {
  const v = obj[key]
  return typeof v === 'string' ? v : undefined
}

// ---------------------------------------------------------------------------
// Auth detection
// ---------------------------------------------------------------------------

function detectAuth(
  doc: Record<string, unknown>,
  operationSecurity: unknown[] | undefined
): 'none' | 'jwt' | 'cookie-or-jwt' {
  // Gather security scheme names that apply to this operation
  const securityReqs: string[] = []

  const effectiveSecurity = operationSecurity ?? (Array.isArray(doc.security) ? doc.security : undefined)
  if (Array.isArray(effectiveSecurity)) {
    for (const req of effectiveSecurity) {
      if (isRecord(req)) {
        securityReqs.push(...Object.keys(req))
      }
    }
  }

  const components = isRecord(doc.components) ? doc.components : {}
  const securitySchemes = isRecord(components.securitySchemes) ? components.securitySchemes : {}

  for (const name of securityReqs) {
    const scheme = securitySchemes[name]
    if (!isRecord(scheme)) continue
    const type = getString(scheme, 'type')
    const scheme2 = getString(scheme, 'scheme')
    const bearerFormat = getString(scheme, 'bearerFormat')
    if (
      type === 'http' &&
      (scheme2?.toLowerCase() === 'bearer' || bearerFormat?.toLowerCase().includes('bearer'))
    ) {
      return 'jwt'
    }
    if (type === 'apiKey') {
      const inVal = getString(scheme, 'in')
      if (inVal === 'header') return 'jwt'
    }
    if (type === 'oauth2' || type === 'openIdConnect') {
      return 'jwt'
    }
  }

  // If no security req matched but schemes exist, check all schemes
  if (securityReqs.length === 0 && Object.keys(securitySchemes).length > 0) {
    for (const scheme of Object.values(securitySchemes)) {
      if (!isRecord(scheme)) continue
      const type = getString(scheme, 'type')
      const scheme2 = getString(scheme, 'scheme')
      if (type === 'http' && scheme2?.toLowerCase() === 'bearer') return 'jwt'
    }
  }

  return 'none'
}

// ---------------------------------------------------------------------------
// Parameter → LocalFieldSpec mapping
// ---------------------------------------------------------------------------

type OpenApiParamIn = 'path' | 'query' | 'header' | 'cookie'

function mapParamType(schema: unknown): LocalFieldSpec['type'] {
  if (!isRecord(schema)) return 'string'
  const t = getString(schema, 'type')
  if (t === 'integer' || t === 'number') return 'number'
  return 'string'
}

function paramToLocalFieldSpec(param: Record<string, unknown>): LocalFieldSpec | null {
  const name = getString(param, 'name')
  if (!name) return null

  const inVal = getString(param, 'in') as OpenApiParamIn | undefined
  if (!inVal || inVal === 'cookie') return null // skip cookies

  const location: LocalFieldSpec['location'] = inVal === 'path'
    ? 'path'
    : inVal === 'query'
    ? 'query'
    : 'header'

  const schema = isRecord(param.schema) ? param.schema : {}
  const type = mapParamType(schema)
  const description = getString(param, 'description') ?? getString(schema, 'description')
  const required = param.required === true || inVal === 'path'

  return {
    name,
    label: description
      ? description.slice(0, 50)
      : name.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    type,
    required,
    location,
  }
}

// ---------------------------------------------------------------------------
// Main parser
// ---------------------------------------------------------------------------

export function parseOpenApi(doc: unknown): ImportedBlock[] {
  if (!isRecord(doc)) return []

  const paths = doc.paths
  if (!isRecord(paths)) return []

  // Base URL from servers[0].url
  let baseUrl = ''
  if (Array.isArray(doc.servers) && doc.servers.length > 0) {
    const first = doc.servers[0]
    if (isRecord(first)) {
      baseUrl = getString(first, 'url') ?? ''
    }
  }
  // Normalize: remove trailing slash
  baseUrl = baseUrl.replace(/\/$/, '')

  const results: ImportedBlock[] = []

  for (const [pathKey, pathItem] of Object.entries(paths)) {
    if (!isRecord(pathItem)) continue

    // Path-level parameters
    const pathLevelParams: Record<string, unknown>[] = Array.isArray(pathItem.parameters)
      ? (pathItem.parameters as unknown[]).filter(isRecord)
      : []

    const methods = ['get', 'post', 'put', 'patch', 'delete'] as const

    for (const method of methods) {
      const operation = pathItem[method]
      if (!isRecord(operation)) continue

      const operationId = getString(operation, 'operationId')
      const summary = getString(operation, 'summary')

      // Skip unidentifiable operations
      if (!operationId && !summary) continue

      // kind
      const kind = operationId
        ? slugify(operationId)
        : `${method}-${slugify(pathKey)}`

      // label
      const label = summary ?? kind

      // auth
      const operationSecurity = Array.isArray(operation.security)
        ? (operation.security as unknown[])
        : undefined
      const auth = detectAuth(doc as Record<string, unknown>, operationSecurity)

      // URL template — OpenAPI uses {param}, keep as-is
      const urlTemplate = `${baseUrl}${pathKey}`

      // Merge path-level + operation-level parameters
      const opParams: Record<string, unknown>[] = Array.isArray(operation.parameters)
        ? (operation.parameters as unknown[]).filter(isRecord)
        : []

      // Operation params override path params by name+in
      const mergedParamsMap = new Map<string, Record<string, unknown>>()
      for (const p of pathLevelParams) {
        const key = `${p.in}:${p.name}`
        mergedParamsMap.set(key, p)
      }
      for (const p of opParams) {
        const key = `${p.in}:${p.name}`
        mergedParamsMap.set(key, p)
      }

      const inputs: LocalFieldSpec[] = []
      for (const param of mergedParamsMap.values()) {
        const field = paramToLocalFieldSpec(param)
        if (field) inputs.push(field)
      }

      // requestBody → body input
      let hasJsonBody = false
      const requestBody = operation.requestBody
      if (isRecord(requestBody)) {
        const content = isRecord(requestBody.content) ? requestBody.content : {}
        const jsonContent = content['application/json']
        if (isRecord(jsonContent)) {
          hasJsonBody = true
          const schema = isRecord(jsonContent.schema) ? jsonContent.schema : {}
          // If schema has properties, add a json body input
          if (isRecord(schema.properties) || schema.type === 'object') {
            inputs.push({
              name: 'body',
              label: 'Request Body',
              type: 'json',
              required: requestBody.required === true,
              location: 'body',
            })
          } else {
            // Still add a json input for unknown schema
            inputs.push({
              name: 'body',
              label: 'Request Body',
              type: 'json',
              required: requestBody.required === true,
              location: 'body',
            })
          }
        }
      }

      // headers
      const headers: Record<string, string> = {}
      const produces = operation.produces
      const hasJsonResponse =
        Array.isArray(produces) && produces.includes('application/json')

      if (hasJsonBody || hasJsonResponse) {
        headers['Content-Type'] = 'application/json'
      }

      // Tags: prefer explicit operation.tags. Fall back to the first
      // non-versioned path segment so tagless specs still group
      // meaningfully (e.g. /v1/users → 'users'). Matches the rule used
      // by the shared OpenAPI importer for bundle imports — keeping
      // both code paths consistent matters for the tree+filter UI.
      const opTags = Array.isArray(operation.tags)
        ? (operation.tags as unknown[]).filter(
            (t): t is string => typeof t === 'string' && t.length > 0,
          )
        : []
      let tags: string[] = opTags
      if (tags.length === 0) {
        const segments = pathKey
          .split('/')
          .filter((s) => s && !s.startsWith('{'))
        const firstMeaningful = segments.find(
          (s) => !/^v\d+$/i.test(s) && s !== 'api',
        )
        if (firstMeaningful) tags = [firstMeaningful]
      }

      const block: ImportedBlock = {
        kind,
        label,
        auth,
        inputs,
        outputs: [
          { jsonPath: 'data', contextKey: 'lastResponse' },
          { jsonPath: 'status', contextKey: 'lastStatus' },
        ],
        request: {
          method: method.toUpperCase() as 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
          urlTemplate,
          ...(Object.keys(headers).length > 0 ? { headers } : {}),
        },
        ...(tags.length > 0 ? { tags } : {}),
        _selected: true,
      }

      results.push(block)
    }
  }

  return results
}
