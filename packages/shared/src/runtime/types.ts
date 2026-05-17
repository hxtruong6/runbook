export type AuthMode = 'none' | 'jwt' | 'cookie-or-jwt'

export type FieldType = 'string' | 'password' | 'number' | 'enum' | 'json'

export type FieldSpec = {
  name: string
  label: string
  type: FieldType
  required?: boolean
  fromContextKey?: string
  enumValues?: readonly string[]
  placeholder?: string
  location?: 'path' | 'query' | 'body' | 'header'
}

export type OutputSpec = {
  jsonPath: string
  contextKey: string
}

export type HttpRequest = {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  url: string
  headers: Record<string, string>
  body?: unknown
}

export type ResolvedRequest = {
  method: string
  url: string
  headers: Record<string, string>
  body?: unknown
}

export type BlockDef = {
  kind: string
  label: string
  inputs: FieldSpec[]
  outputs: OutputSpec[]
  auth: AuthMode
  urlTemplate?: string
  method?: string
  hidden?: boolean
  build: (values: Record<string, unknown>) => HttpRequest
}

export type BlockInstance = {
  id: string
  kind: string
  overrides: Record<string, unknown>
}

export type RuntimeContext = Record<string, unknown> & {
  socketSessionUuid: string
}

export type BlockRunResult =
  | {
      status: 'ok'
      httpStatus: number
      elapsedMs: number
      response: unknown
      captured: Record<string, unknown>
      request?: ResolvedRequest
      subResults?: BlockRunResult[]
    }
  | {
      status: 'err'
      httpStatus?: number
      elapsedMs: number
      response: unknown
      error: string
      request?: ResolvedRequest
      subResults?: BlockRunResult[]
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

export type Scenario = {
  id: string
  name: string
  createdAt: string
  blocks: BlockInstance[]
  reusable?: boolean
}

export type ScenarioLookup = (id: string) => Scenario | null

export type RunRequestOptions = {
  auth: AuthMode
  jwt?: string
  envAuth?: AuthConfig
  envHeaders?: Record<string, string>
}

export type RunRequestResult = {
  httpStatus: number
  body: unknown
  elapsedMs: number
  resolvedRequest: ResolvedRequest
}

export type Fetcher = (req: HttpRequest, opts: RunRequestOptions) => Promise<RunRequestResult>
