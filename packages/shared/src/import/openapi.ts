/**
 * OpenAPI 3.x → ProjectBundle importer.
 *
 * Produces a ProjectBundle (matching the bundle-format.md spec) from an
 * OpenAPI 3.x document.  The document can be supplied as a URL string or as
 * a pre-parsed plain object.
 *
 * Key mapping decisions
 * ─────────────────────
 *  • One BlockDefData per operation (method + path).
 *  • Inputs come from path/query/header parameters + top-level requestBody
 *    JSON-schema properties.  Nested objects collapse into a single `body`
 *    field of type "json".
 *  • Operations are grouped by their first `tags` entry into Scenarios.
 *    Tag-less operations go into a "Misc" scenario.
 *  • One Environment per securityScheme in `components/securitySchemes`:
 *      bearer / oauth2 / openIdConnect → { kind:"bearer", token:"<set me>" }
 *      apiKey in header → { kind:"apiKey", in:"header", name, value:"<set me>" }
 *      apiKey in query  → { kind:"apiKey", in:"query",  name, value:"<set me>" }
 *      http basic → { kind:"basic", username:"<set me>", password:"<set me>" }
 *  • Server URL: servers[0].url with {variables} interpolated using defaults.
 */

// ---------------------------------------------------------------------------
// Bundle shape — imported from runtime package
// ---------------------------------------------------------------------------

import type {
  ProjectBundle,
  BlockDefData,
  BlockInstance,
  BundleVersion,
  FieldSpec,
  Environment,
} from '../runtime/index.js'

// ---------------------------------------------------------------------------
// Minimal OpenAPI 3.x structural types (subset we need)
// ---------------------------------------------------------------------------

interface OaServer {
  url?: string
  variables?: Record<string, { default?: string }>
}

interface OaSchema {
  type?: string
  format?: string
  description?: string
  properties?: Record<string, OaSchema>
  required?: string[]
  items?: OaSchema
  enum?: string[]
  '$ref'?: string
}

interface OaParameter {
  name?: string
  in?: 'path' | 'query' | 'header' | 'cookie'
  description?: string
  required?: boolean
  schema?: OaSchema
}

interface OaMediaObject {
  schema?: OaSchema
}

interface OaRequestBody {
  required?: boolean
  content?: Record<string, OaMediaObject>
}

interface OaOperation {
  operationId?: string
  summary?: string
  description?: string
  tags?: string[]
  parameters?: OaParameter[]
  requestBody?: OaRequestBody
  security?: Array<Record<string, string[]>>
}

type OaMethod = 'get' | 'post' | 'put' | 'delete'

interface OaPathItem {
  parameters?: OaParameter[]
  get?: OaOperation
  post?: OaOperation
  put?: OaOperation
  delete?: OaOperation
}

interface OaSecurityScheme {
  type?: string
  scheme?: string
  in?: 'header' | 'query' | 'cookie'
  name?: string
  flows?: unknown
}

interface OaComponents {
  securitySchemes?: Record<string, OaSecurityScheme>
}

interface OpenApiDoc {
  openapi?: string
  info?: { title?: string; version?: string; description?: string }
  servers?: OaServer[]
  paths?: Record<string, OaPathItem>
  components?: OaComponents
  security?: Array<Record<string, string[]>>
  tags?: Array<{ name?: string }>
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isRecord(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val)
}

function slugify(str: string): string {
  return str
    // Insert hyphen before each uppercase letter preceded by a lowercase letter or digit (camelCase)
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function resolveServerUrl(doc: OpenApiDoc): string {
  if (!doc.servers || doc.servers.length === 0) return ''
  const server = doc.servers[0]!
  let url = server.url ?? ''
  // Interpolate {variable} placeholders with default values
  if (server.variables) {
    for (const [varName, varDef] of Object.entries(server.variables)) {
      const defaultVal = varDef.default ?? ''
      url = url.replace(`{${varName}}`, defaultVal)
    }
  }
  return url.replace(/\/$/, '')
}

// Map OpenAPI schema type to our FieldSpec type
function schemaToFieldType(schema: OaSchema | undefined): FieldSpec['type'] {
  if (!schema) return 'string'
  if (schema.enum && schema.enum.length > 0) return 'enum'
  if (schema.type === 'integer' || schema.type === 'number') return 'number'
  if (schema.format === 'password') return 'password'
  if (schema.type === 'object' || schema.type === 'array') return 'json'
  return 'string'
}

function paramToFieldSpec(param: OaParameter): FieldSpec | null {
  if (!param.name) return null
  if (!param.in || param.in === 'cookie') return null

  const type = schemaToFieldType(param.schema)
  const required = param.required === true || param.in === 'path'
  const label =
    param.description
      ? param.description.slice(0, 60)
      : param.name.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

  const fs: FieldSpec = {
    name: param.name,
    label,
    type,
    required,
    location: param.in as FieldSpec['location'],
  }

  if (type === 'enum' && param.schema?.enum) {
    fs.enumValues = [...param.schema.enum]
  }

  return fs
}

/**
 * Flatten top-level requestBody JSON schema properties into FieldSpec[].
 * Nested objects → single `body` field of type "json".
 */
function requestBodyToFields(
  requestBody: OaRequestBody | undefined,
): FieldSpec[] {
  if (!requestBody) return []
  const content = requestBody.content
  if (!content) return []

  // Prefer application/json
  const media = content['application/json'] ?? Object.values(content)[0]
  if (!media) return []

  const schema = media.schema
  if (!schema) return []

  const required = requestBody.required === true
  const requiredProps = new Set<string>(schema.required ?? [])

  if (schema.type === 'object' && schema.properties) {
    const fields: FieldSpec[] = []
    for (const [propName, propSchema] of Object.entries(schema.properties)) {
      const propType = schemaToFieldType(propSchema)
      const field: FieldSpec = {
        name: propName,
        label: propName.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        type: propType,
        required: requiredProps.has(propName),
        location: 'body',
      }
      if (propType === 'enum' && propSchema.enum) {
        field.enumValues = [...propSchema.enum]
      }
      fields.push(field)
    }
    return fields
  }

  // Fallback: single body field
  return [
    {
      name: 'body',
      label: 'Request Body',
      type: 'json',
      required,
      location: 'body',
    },
  ]
}

function detectAuth(
  doc: OpenApiDoc,
  operationSecurity: Array<Record<string, string[]>> | undefined,
): BlockDefData['auth'] {
  const effectiveSecurity = operationSecurity ?? doc.security
  if (!effectiveSecurity || effectiveSecurity.length === 0) return 'none'

  const securitySchemeNames = effectiveSecurity.flatMap((req) => Object.keys(req))
  const schemes = doc.components?.securitySchemes ?? {}

  for (const name of securitySchemeNames) {
    const scheme = schemes[name]
    if (!scheme) continue
    if (scheme.type === 'http' && scheme.scheme?.toLowerCase() === 'bearer') return 'jwt'
    if (scheme.type === 'oauth2' || scheme.type === 'openIdConnect') return 'jwt'
    if (scheme.type === 'apiKey') return 'jwt'
    if (scheme.type === 'http' && scheme.scheme?.toLowerCase() === 'basic') return 'none'
  }

  return 'none'
}

// ---------------------------------------------------------------------------
// Environment generation from securitySchemes
// ---------------------------------------------------------------------------

function buildEnvironments(doc: OpenApiDoc, baseUrl: string): Environment[] {
  const schemes = doc.components?.securitySchemes
  if (!schemes || Object.keys(schemes).length === 0) return []

  const envs: Environment[] = []
  const now = new Date().toISOString()

  for (const [schemeName, scheme] of Object.entries(schemes)) {
    const id = `env-${slugify(schemeName)}`
    const name = schemeName

    if (scheme.type === 'http' && scheme.scheme?.toLowerCase() === 'bearer') {
      envs.push({
        id,
        name,
        baseUrl,
        auth: { kind: 'bearer', token: '<set me>' },
        headers: {},
        createdAt: now,
      })
    } else if (scheme.type === 'oauth2' || scheme.type === 'openIdConnect') {
      envs.push({
        id,
        name,
        baseUrl,
        auth: { kind: 'bearer', token: '<set me>' },
        headers: {},
        createdAt: now,
      })
    } else if (scheme.type === 'apiKey') {
      const inVal = (scheme.in === 'query' ? 'query' : 'header') as 'header' | 'query'
      const keyName = scheme.name ?? 'api_key'
      envs.push({
        id,
        name,
        baseUrl,
        auth: { kind: 'apiKey', in: inVal, name: keyName, value: '<set me>' },
        headers: {},
        createdAt: now,
      })
    } else if (scheme.type === 'http' && scheme.scheme?.toLowerCase() === 'basic') {
      envs.push({
        id,
        name,
        baseUrl,
        auth: { kind: 'basic', username: '<set me>', password: '<set me>' },
        headers: {},
        createdAt: now,
      })
    }
  }

  return envs
}

// ---------------------------------------------------------------------------
// Core parsing: OpenApiDoc → { blocks, scenariosByTag }
// ---------------------------------------------------------------------------

type ParsedOperation = {
  block: BlockDefData
  tag: string
  operationKey: string
}

const SUPPORTED_METHODS: OaMethod[] = ['get', 'post', 'put', 'delete']

function parseOperations(doc: OpenApiDoc, baseUrl: string): ParsedOperation[] {
  const paths = doc.paths ?? {}
  const results: ParsedOperation[] = []

  for (const [pathKey, pathItem] of Object.entries(paths)) {
    if (!isRecord(pathItem)) continue

    const pathLevelParams: OaParameter[] = Array.isArray(pathItem.parameters)
      ? (pathItem.parameters as OaParameter[])
      : []

    for (const method of SUPPORTED_METHODS) {
      const operation = (pathItem as Record<string, OaOperation | undefined>)[method]
      if (!operation) continue

      const operationId = operation.operationId
      const summary = operation.summary

      const kind = operationId
        ? slugify(operationId)
        : `${method}-${slugify(pathKey)}`

      const label = summary ?? kind

      // Merge path-level and operation-level parameters (op overrides path by name+in)
      const opParams: OaParameter[] = Array.isArray(operation.parameters)
        ? (operation.parameters as OaParameter[])
        : []

      const merged = new Map<string, OaParameter>()
      for (const p of pathLevelParams) {
        merged.set(`${p.in}:${p.name}`, p)
      }
      for (const p of opParams) {
        merged.set(`${p.in}:${p.name}`, p)
      }

      const paramFields: FieldSpec[] = []
      for (const param of merged.values()) {
        const f = paramToFieldSpec(param)
        if (f) paramFields.push(f)
      }

      const bodyFields = requestBodyToFields(operation.requestBody)
      const inputs: FieldSpec[] = [...paramFields, ...bodyFields]

      const auth = detectAuth(doc, operation.security)

      // Build URL template: OpenAPI {param} → keep as-is (supported by urlTemplate engine)
      const urlTemplate = `${baseUrl}${pathKey}`

      // Tags: union of operation.tags + first path segment as fallback.
      // First path segment is a cheap grouping signal when a spec ships
      // without explicit tags. Deduplicated, original casing preserved.
      const opTags = Array.isArray(operation.tags)
        ? operation.tags.filter((t): t is string => typeof t === 'string' && t.length > 0)
        : []
      const firstSegment = pathKey.split('/').filter((s) => s && !s.startsWith('{'))[0]
      const tagSet = new Set<string>(opTags)
      if (firstSegment) tagSet.add(firstSegment)
      const tags = Array.from(tagSet)

      const block: BlockDefData = {
        kind,
        label,
        auth,
        inputs: inputs as BlockDefData['inputs'],
        outputs: [
          { jsonPath: 'data', contextKey: 'lastResponse' },
          { jsonPath: 'status', contextKey: 'lastStatus' },
        ],
        request: {
          method: method.toUpperCase() as 'GET' | 'POST' | 'PUT' | 'DELETE',
          urlTemplate,
        },
        ...(tags.length > 0 ? { tags } : {}),
      }

      const tag = opTags[0] ?? 'Misc'

      results.push({ block, tag, operationKey: `${method}:${pathKey}` })
    }
  }

  return results
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface ImportOpenApiOptions {
  /** Only include operations whose tag is in this set (all if omitted) */
  includeTags?: Set<string>
}

/**
 * Parse an OpenAPI 3.x document and produce a ProjectBundle.
 *
 * @param specUrlOrDoc  URL string, or a pre-parsed plain JS object.
 */
export async function importOpenApi(
  specUrlOrDoc: string | unknown,
  options: ImportOpenApiOptions = {},
): Promise<ProjectBundle> {
  let doc: OpenApiDoc

  if (typeof specUrlOrDoc === 'string') {
    // Dynamically import swagger-parser only at runtime (keeps tree-shaking clean)
    const { default: SwaggerParser } = await import('@apidevtools/swagger-parser')
    doc = (await SwaggerParser.dereference(specUrlOrDoc)) as unknown as OpenApiDoc
  } else {
    // Treat as pre-parsed object (dereferences are already resolved by caller)
    doc = specUrlOrDoc as OpenApiDoc
  }

  const now = new Date().toISOString()
  const baseUrl = resolveServerUrl(doc)

  const operations = parseOperations(doc, baseUrl)

  // Group into scenarios by tag
  const tagOrder: string[] = []
  const byTag = new Map<string, ParsedOperation[]>()

  for (const op of operations) {
    const { tag } = op

    // Apply tag filter
    if (options.includeTags && !options.includeTags.has(tag)) continue

    if (!byTag.has(tag)) {
      tagOrder.push(tag)
      byTag.set(tag, [])
    }
    byTag.get(tag)!.push(op)
  }

  const allBlocks: BlockDefData[] = []
  const scenarios: BundleVersion['scenarios'] = []

  for (const tag of tagOrder) {
    const ops = byTag.get(tag)!
    const scenarioId = `scen-${slugify(tag)}-${Date.now().toString(36)}`
    const blockInstances: BlockInstance[] = []

    for (const { block } of ops) {
      // Deduplicate blocks by kind
      if (!allBlocks.find((b) => b.kind === block.kind)) {
        allBlocks.push(block)
      }
      blockInstances.push({
        id: `bi-${block.kind}`,
        kind: block.kind,
        overrides: {},
      })
    }

    scenarios.push({
      id: scenarioId,
      name: tag,
      createdAt: now,
      reusable: false,
      blocks: blockInstances,
    })
  }

  const environments = buildEnvironments(doc, baseUrl)

  const title = doc.info?.title ?? 'Imported API'
  const description = doc.info?.description
  const apiVersion = doc.info?.version ?? '1.0.0'
  const projectId = slugify(title) + '-imported'

  const version: BundleVersion = {
    version: apiVersion,
    releasedAt: now,
    releaseNotes: `# ${title} v${apiVersion}\n\nImported from OpenAPI specification.`,
    changes: allBlocks.map((b) => ({
      type: 'added' as const,
      target: b.kind,
      summary: `${b.label} endpoint`,
    })),
    blocks: allBlocks,
    scenarios,
    environments,
    docs: {},
  }

  return {
    id: projectId,
    name: title,
    description,
    createdAt: now,
    versions: [version],
  }
}

/**
 * Parse a pre-fetched OpenAPI spec (JSON string, JS object, or URL).
 * Same as importOpenApi but synchronous when given a plain object.
 * For URL strings it still returns a Promise.
 */
export { importOpenApi as default }
