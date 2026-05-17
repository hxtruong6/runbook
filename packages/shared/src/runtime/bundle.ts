import { z } from 'zod'

const FieldTypeSchema = z.enum(['string', 'password', 'number', 'enum', 'json'])

const FieldSpecSchema = z.object({
  name: z.string(),
  label: z.string(),
  type: FieldTypeSchema,
  required: z.boolean().optional(),
  fromContextKey: z.string().optional(),
  enumValues: z.array(z.string()).optional(),
  placeholder: z.string().optional(),
  location: z.enum(['path', 'query', 'body', 'header']).optional(),
})

const OutputSpecSchema = z.object({
  jsonPath: z.string(),
  contextKey: z.string(),
})

const AuthModeSchema = z.enum(['none', 'jwt', 'cookie-or-jwt'])

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
  ])
)

const RequestSchema = z.object({
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE']),
  urlTemplate: z.string(),
  headers: z.record(z.string(), z.string()).optional(),
  query: z.record(z.string(), z.string()).optional(),
  bodyTemplate: JsonTemplateValueSchema.optional(),
})

export const BlockDefDataSchema = z.object({
  kind: z.string(),
  label: z.string(),
  auth: AuthModeSchema,
  inputs: z.array(FieldSpecSchema),
  outputs: z.array(OutputSpecSchema),
  request: RequestSchema,
})

const BlockInstanceSchema = z.object({
  id: z.string(),
  kind: z.string(),
  overrides: z.record(z.string(), z.unknown()),
})

const ScenarioSchema = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.string(),
  blocks: z.array(BlockInstanceSchema),
  reusable: z.boolean().optional().default(false),
  graphData: z.unknown().optional(),
})

const AuthConfigSchema = z.discriminatedUnion('kind', [
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

const EnvironmentSchema = z.object({
  id: z.string(),
  name: z.string(),
  baseUrl: z.string().url(),
  auth: AuthConfigSchema,
  headers: z.record(z.string(), z.string()).default({}),
  createdAt: z.string(),
})

const ChangeTypeSchema = z.enum(['added', 'modified', 'deprecated', 'removed', 'fixed', 'note'])

const ChangeEntrySchema = z.object({
  type: ChangeTypeSchema,
  target: z.string().optional(),
  summary: z.string(),
  breaking: z.boolean().optional(),
  removeBy: z.string().optional(),
})

export const BundleVersionSchema = z.object({
  version: z.string(),
  releasedAt: z.string(),
  releaseNotes: z.string(),
  changes: z.array(ChangeEntrySchema),
  blocks: z.array(BlockDefDataSchema),
  scenarios: z.array(ScenarioSchema),
  environments: z.array(EnvironmentSchema),
  docs: z.record(z.string(), z.string()),
})

export const ProjectBundleSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  createdAt: z.string(),
  versions: z.array(BundleVersionSchema),
})

export type BlockDefData = z.infer<typeof BlockDefDataSchema>
export type BundleVersion = z.infer<typeof BundleVersionSchema>
export type ProjectBundle = z.infer<typeof ProjectBundleSchema>
