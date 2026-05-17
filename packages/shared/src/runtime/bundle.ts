// packages/shared/src/runtime/bundle.ts
// Lightweight ProjectBundle types shared between the web app and importers.
// The web app's zod-based ProjectBundleSchema is authoritative for validation;
// these types serve as the structural contract for importers.

export type AuthMode = 'none' | 'jwt' | 'cookie-or-jwt'

export type FieldSpec = {
  name: string
  label: string
  type: 'string' | 'password' | 'number' | 'enum' | 'json'
  required?: boolean
  fromContextKey?: string
  enumValues?: string[]
  placeholder?: string
  location?: 'path' | 'query' | 'body' | 'header'
}

export type OutputSpec = {
  jsonPath: string
  contextKey: string
}

export type BlockDefData = {
  kind: string
  label: string
  auth: AuthMode
  inputs: FieldSpec[]
  outputs: OutputSpec[]
  request: {
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
    urlTemplate: string
    headers?: Record<string, string>
    bodyTemplate?: unknown
  }
}

export type BlockInstance = {
  id: string
  kind: string
  overrides: Record<string, unknown>
}

export type Scenario = {
  id: string
  name: string
  createdAt: string
  blocks: BlockInstance[]
  reusable?: boolean
}

export type AuthConfig =
  | { kind: 'bearer'; token: string }
  | { kind: 'cookie'; token?: string }
  | { kind: 'apiKey'; in: 'header' | 'query'; name: string; value: string }
  | { kind: 'basic'; username: string; password: string }
  | { kind: 'none' }

export type Environment = {
  id: string
  name: string
  baseUrl: string
  auth: AuthConfig
  headers: Record<string, string>
  createdAt: string
}

export type ChangeEntry = {
  type: 'added' | 'modified' | 'deprecated' | 'removed' | 'fixed' | 'note'
  target?: string
  summary: string
  breaking?: boolean
  removeBy?: string
}

export type ProjectVersion = {
  version: string
  releasedAt: string
  releaseNotes: string
  changes: ChangeEntry[]
  blocks: BlockDefData[]
  scenarios: Scenario[]
  environments: Environment[]
  docs: Record<string, string>
}

export type ProjectBundle = {
  id: string
  name: string
  description?: string
  createdAt: string
  versions: ProjectVersion[]
}
