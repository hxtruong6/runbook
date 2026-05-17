// tests/share/runFromUrl.test.ts
// Unit tests for the bundle fetch / validation logic used by RunFromUrl.
// We test the schema validation and error classification in isolation.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ProjectBundleSchema } from '../../src/projects/types'

// ---------------------------------------------------------------------------
// Minimal valid bundle fixture
// ---------------------------------------------------------------------------

const VALID_BUNDLE = {
  id: 'test-bundle',
  name: 'Test Bundle',
  description: 'For testing',
  createdAt: '2026-01-01T00:00:00Z',
  versions: [
    {
      version: '1.0.0',
      releasedAt: '2026-01-01T00:00:00Z',
      releaseNotes: '',
      changes: [],
      blocks: [],
      scenarios: [],
      environments: [],
      docs: {},
    },
  ],
}

// ---------------------------------------------------------------------------
// Schema validation
// ---------------------------------------------------------------------------

describe('RunFromUrl — bundle schema validation', () => {
  it('accepts a valid bundle', () => {
    const result = ProjectBundleSchema.safeParse(VALID_BUNDLE)
    expect(result.success).toBe(true)
  })

  it('rejects a bundle with no id', () => {
    const { id: _id, ...noId } = VALID_BUNDLE
    const result = ProjectBundleSchema.safeParse(noId)
    expect(result.success).toBe(false)
  })

  it('rejects a bundle with no versions array', () => {
    const { versions: _v, ...noVersions } = VALID_BUNDLE
    const result = ProjectBundleSchema.safeParse(noVersions)
    expect(result.success).toBe(false)
  })

  it('rejects a bundle with an invalid version entry (missing version string)', () => {
    const bad = {
      ...VALID_BUNDLE,
      versions: [{ ...VALID_BUNDLE.versions[0], version: undefined }],
    }
    const result = ProjectBundleSchema.safeParse(bad)
    expect(result.success).toBe(false)
  })

  it('rejects completely non-bundle JSON', () => {
    const result = ProjectBundleSchema.safeParse({ foo: 'bar' })
    expect(result.success).toBe(false)
  })

  it('rejects a string payload', () => {
    const result = ProjectBundleSchema.safeParse('not-an-object')
    expect(result.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// URL / CORS error classification (pure logic — no fetch)
// ---------------------------------------------------------------------------

function classifyFetchError(err: Error): 'cors' | 'network' {
  const msg = err.message.toLowerCase()
  if (
    msg.includes('cors') ||
    msg.includes('failed to fetch') ||
    msg.includes('network')
  ) {
    return 'cors'
  }
  return 'network'
}

describe('RunFromUrl — fetch error classification', () => {
  it('classifies "Failed to fetch" as cors', () => {
    expect(classifyFetchError(new Error('Failed to fetch'))).toBe('cors')
  })

  it('classifies "CORS policy" as cors', () => {
    expect(classifyFetchError(new Error('Blocked by CORS policy'))).toBe('cors')
  })

  it('classifies "NetworkError" as cors', () => {
    expect(classifyFetchError(new Error('NetworkError when attempting to fetch resource'))).toBe('cors')
  })

  it('classifies "500 Internal Server Error" as network', () => {
    expect(classifyFetchError(new Error('500 Internal Server Error'))).toBe('network')
  })

  it('classifies generic errors as network', () => {
    expect(classifyFetchError(new Error('Unexpected token'))).toBe('network')
  })
})

// ---------------------------------------------------------------------------
// Telemetry helper
// ---------------------------------------------------------------------------

describe('telemetry helper', () => {
  beforeEach(() => {
    // Reset __rb_events__ before each test
    ;(window as Window & { __rb_events__?: unknown[] }).__rb_events__ = []
  })

  afterEach(() => {
    delete (window as Window & { __rb_events__?: unknown[] }).__rb_events__
  })

  it('pushes events to window.__rb_events__ when present', async () => {
    const { trackEvent } = await import('../../src/features/onboarding/telemetry')
    trackEvent({ event: 'run_from_url', bundle_host: 'example.com', referrer: null })
    expect((window as Window & { __rb_events__?: unknown[] }).__rb_events__).toHaveLength(1)
    expect((window as Window & { __rb_events__?: unknown[] }).__rb_events__?.[0]).toMatchObject({
      event: 'run_from_url',
      bundle_host: 'example.com',
    })
  })

  it('does not throw when __rb_events__ is absent', async () => {
    delete (window as Window & { __rb_events__?: unknown[] }).__rb_events__
    const { trackEvent } = await import('../../src/features/onboarding/telemetry')
    expect(() => trackEvent({ event: 'run_from_url' })).not.toThrow()
  })
})
