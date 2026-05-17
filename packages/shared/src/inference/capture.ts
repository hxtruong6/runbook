// Capture a single block-run observation into a block definition.
// Pure function; the caller (web app store / CLI) is responsible for persisting.
import { redactObject } from '../redact.js'
import { detectDrift, inferSchema, mergeSchemas, type DriftPath, type InferredSchema } from './schema.js'

export type StatusFamily = '2xx' | '4xx' | '5xx' | 'network'

export type InferenceObservation = {
  family: StatusFamily
  schema: InferredSchema
  example: unknown // already redacted
  capturedAt: string
}

export type BlockInference = {
  // Per status family — APIs return different shapes on error.
  schemas: Partial<Record<StatusFamily, InferredSchema>>
  examples: Partial<Record<StatusFamily, unknown>>
  runs: number
  lastDrift?: DriftPath[]
  lastCapturedAt?: string
}

export function familyOf(httpStatus: number | undefined): StatusFamily {
  if (!httpStatus || httpStatus === 0) return 'network'
  if (httpStatus >= 200 && httpStatus < 300) return '2xx'
  if (httpStatus >= 400 && httpStatus < 500) return '4xx'
  if (httpStatus >= 500) return '5xx'
  return 'network'
}

export type CaptureInput = {
  httpStatus?: number
  body: unknown
}

export type CaptureResult = {
  next: BlockInference
  observation: InferenceObservation
  drift: DriftPath[]
}

// Returns a new BlockInference; never mutates `prev`. Returns null if the body
// is uninteresting (e.g. null body on a network error or empty string).
export function captureFromResult(
  prev: BlockInference | undefined,
  input: CaptureInput
): CaptureResult | null {
  const family = familyOf(input.httpStatus)
  if (family === 'network') return null
  if (input.body == null) return null

  const example = redactObject(input.body)
  const fresh = inferSchema(example)
  const prevSchema = prev?.schemas?.[family]
  const merged = prevSchema ? mergeSchemas(prevSchema, fresh) : fresh
  const drift = prevSchema ? detectDrift(prevSchema, fresh) : []

  const next: BlockInference = {
    schemas: { ...(prev?.schemas ?? {}), [family]: merged },
    examples: { ...(prev?.examples ?? {}), [family]: example },
    runs: (prev?.runs ?? 0) + 1,
    lastDrift: drift.length > 0 ? drift : undefined,
    lastCapturedAt: new Date().toISOString(),
  }

  return {
    next,
    observation: {
      family,
      schema: fresh,
      example,
      capturedAt: next.lastCapturedAt!,
    },
    drift,
  }
}
