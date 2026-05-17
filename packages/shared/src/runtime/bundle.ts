// packages/shared/src/runtime/bundle.ts
// Portable (no-DOM) types and Zod schema for the ProjectBundle format.

import { z } from 'zod'

// ---------------------------------------------------------------------------
// FieldSpec
// ---------------------------------------------------------------------------

export const FieldTypeSchema = z.enum(['string', 'password', 'number', 'enum', 'json'])
export type FieldType = z.infer<typeof FieldTypeSchema>

export const FieldSpecSchema = z.object({
  name: z.string(),
  label: z.string(),
  type: FieldTypeSchema,
  required: z.boolean().optional(),
  fromContextKey: z.string().optional(),
  enumValues: z.array(z.string()).optional(),
  placeholder: z.string().optional(),
  location: z.enum(['path', 'query', 'body', 'header']).optional(),
})
export type FieldSpec = z.infer<typeof FieldSpecSchema>

// ---------------------------------------------------------------------------
// OutputSpec
// ---------------------------------------------------------------------------

export const OutputSpecSchema = z.object({
  jsonPath: z.string(),
  contextKey: z.string(),
})
export type OutputSpec = z.infer<typeof OutputSpecSchema>

// ---------------------------------------------------------------------------
// AuthMode
// ---------------------------------------------------------------------------

export const AuthModeSchema = z.enum(['none', 'jwt', 'cookie-or-jwt'])
export type AuthMode = z.infer<typeof AuthModeSchema>

// ---------------------------------------------------------------------------
// RequestDef
// ---------------------------------------------------------------------------

type JsonTemplateValue =
  | string
  | number
  | boolean
  | null
  | JsonTemplateValue[]
  | { [key: string]: JsonTemplateValue }

const JsonTemplateValueSchema: z.ZodType<JsonTemplateValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(JsonTemplateValueSchema),
    z.record(z.string(), JsonTemplateValueSchema),
  ]),
)

export const RequestDefSchema = z.object({
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE']),
  urlTemplate: z.string(),
  headers: z.record(z.string(), z.string()).optional(),
  query: z.record(z.string(), z.string()).optional(),
  bodyTemplate: JsonTemplateValueSchema.optional(),
})
export type RequestDef = z.infer<typeof RequestDefSchema>

// ---------------------------------------------------------------------------
// BlockDefData — the portable serialised form (no `build` function)
// ---------------------------------------------------------------------------

export const BlockDefDataSchema = z.object({
  kind: z.string(),
  label: z.string(),
  auth: AuthModeSchema,
  inputs: z.array(FieldSpecSchema),
  outputs: z.array(OutputSpecSchema),
  request: RequestDefSchema,
})
export type BlockDefData = z.infer<typeof BlockDefDataSchema>

// ---------------------------------------------------------------------------
// BlockInstance
// ---------------------------------------------------------------------------

export const BlockInstanceSchema = z.object({
  id: z.string(),
  kind: z.string(),
  overrides: z.record(z.string(), z.unknown()),
})
export type BlockInstance = z.infer<typeof BlockInstanceSchema>

// ---------------------------------------------------------------------------
// Scenario
// ---------------------------------------------------------------------------

export const ScenarioSchema = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.string(),
  blocks: z.array(BlockInstanceSchema),
  reusable: z.boolean().optional().default(false),
  // graphData intentionally omitted — not needed at runtime
})
export type Scenario = z.infer<typeof ScenarioSchema>

// ---------------------------------------------------------------------------
// AuthConfig / Environment
// ---------------------------------------------------------------------------

export const AuthConfigSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('bearer'), token: z.string() }),
  z.object({ kind: z.literal('cookie'), token: z.string().optional() }),
  z.object({
    kind: z.literal('apiKey'),
    in: z.enum(['header', 'query']),
    name: z.string(),
    value: z.string(),
  }),
  z.object({ kind: z.literal('basic'), username: z.string(), password: z.string() }),
  z.object({ kind: z.literal('none') }),
])
export type AuthConfig = z.infer<typeof AuthConfigSchema>

export const EnvironmentSchema = z.object({
  id: z.string(),
  name: z.string(),
  baseUrl: z.string(),
  auth: AuthConfigSchema,
  headers: z.record(z.string(), z.string()).default({}),
  createdAt: z.string(),
})
export type Environment = z.infer<typeof EnvironmentSchema>

// ---------------------------------------------------------------------------
// ChangeEntry / Version / ProjectBundle
// ---------------------------------------------------------------------------

export const ChangeEntrySchema = z.object({
  type: z.enum(['added', 'modified', 'deprecated', 'removed', 'fixed', 'note']),
  target: z.string().optional(),
  summary: z.string(),
  breaking: z.boolean().optional(),
  removeBy: z.string().optional(),
})
export type ChangeEntry = z.infer<typeof ChangeEntrySchema>

export const VersionSchema = z.object({
  version: z.string(),
  releasedAt: z.string(),
  releaseNotes: z.string(),
  changes: z.array(ChangeEntrySchema),
  blocks: z.array(BlockDefDataSchema),
  scenarios: z.array(ScenarioSchema),
  environments: z.array(EnvironmentSchema),
  docs: z.record(z.string(), z.string()),
})
export type ProjectVersion = z.infer<typeof VersionSchema>

export const ProjectBundleSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  createdAt: z.string(),
  versions: z.array(VersionSchema),
})
export type ProjectBundle = z.infer<typeof ProjectBundleSchema>
