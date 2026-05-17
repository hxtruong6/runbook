// packages/mcp-server/tests/server.test.ts
import { describe, it, expect, vi } from 'vitest'
import { sanitizeToolName, buildInputSchema, createServer } from '../src/index.js'
import type { Fetcher } from '@runbook/shared/runtime'
import { writeFile, mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

// ---------------------------------------------------------------------------
// Minimal bundle fixture
// ---------------------------------------------------------------------------

const sampleBundle = {
  id: 'test-api',
  name: 'Test API',
  createdAt: '2026-01-01T00:00:00Z',
  versions: [
    {
      version: '1.0.0',
      releasedAt: '2026-01-01T00:00:00Z',
      releaseNotes: 'Initial',
      changes: [],
      docs: {},
      blocks: [
        {
          kind: 'create-user',
          label: 'Create User',
          auth: 'none',
          inputs: [
            { name: 'email', label: 'Email', type: 'string', required: true },
            { name: 'role', label: 'Role', type: 'enum', enumValues: ['admin', 'user'] },
          ],
          outputs: [{ jsonPath: 'data.id', contextKey: 'userId' }],
          request: {
            method: 'POST',
            urlTemplate: '/users',
            bodyTemplate: { email: '{{email}}', role: '{{role}}' },
          },
        },
        {
          kind: 'get-profile',
          label: 'Get Profile',
          auth: 'none',
          inputs: [
            {
              name: 'userId',
              label: 'User ID',
              type: 'string',
              required: true,
              fromContextKey: 'userId',
            },
          ],
          outputs: [{ jsonPath: 'name', contextKey: 'userName' }],
          request: {
            method: 'GET',
            urlTemplate: '/users/{{userId}}',
          },
        },
      ],
      scenarios: [
        {
          id: 'scen-register',
          name: 'Register and fetch profile',
          createdAt: '2026-01-01T00:00:00Z',
          blocks: [
            { id: 'b1', kind: 'create-user', overrides: {} },
            { id: 'b2', kind: 'get-profile', overrides: {} },
          ],
        },
        {
          id: 'scen-create-only',
          name: 'Create user only',
          createdAt: '2026-01-01T00:00:00Z',
          blocks: [{ id: 'b3', kind: 'create-user', overrides: { role: 'user' } }],
        },
      ],
      environments: [
        {
          id: 'env-1',
          name: 'Local',
          baseUrl: 'https://api.example.com',
          auth: { kind: 'none' },
          headers: {},
          createdAt: '2026-01-01T00:00:00Z',
        },
      ],
    },
  ],
}

// ---------------------------------------------------------------------------
// Stub fetcher
// ---------------------------------------------------------------------------

function makeFetcher(responses: Array<{ status: number; body: unknown }>): Fetcher {
  let call = 0
  return async (_req, _opts) => {
    const r = responses[call++ % responses.length]
    return {
      httpStatus: r.status,
      body: r.body,
      elapsedMs: 0,
      resolvedRequest: { method: _req.method, url: _req.url, headers: _req.headers, body: _req.body },
    }
  }
}

// ---------------------------------------------------------------------------
// Minimal extra context that tools receive
// ---------------------------------------------------------------------------

function makeExtra() {
  return {
    _meta: undefined as { progressToken?: string | number } | undefined,
    requestId: 'test-req-1',
    sendNotification: vi.fn().mockResolvedValue(undefined),
    sendRequest: vi.fn(),
  }
}

// ---------------------------------------------------------------------------
// Helper: write bundle to a temp file and create server
// ---------------------------------------------------------------------------

async function withBundleFile(
  bundle: unknown,
  fn: (bundlePath: string) => Promise<void>,
): Promise<void> {
  const dir = join(tmpdir(), `mcp-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  await mkdir(dir, { recursive: true })
  const bundlePath = join(dir, 'bundle.json')
  await writeFile(bundlePath, JSON.stringify(bundle))
  try {
    await fn(bundlePath)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

// ---------------------------------------------------------------------------
// Unit tests: sanitizeToolName
// ---------------------------------------------------------------------------

describe('sanitizeToolName', () => {
  it('passes through clean ids unchanged', () => {
    expect(sanitizeToolName('my-scenario')).toBe('my-scenario')
  })

  it('replaces spaces with underscores', () => {
    expect(sanitizeToolName('hello world')).toBe('hello_world')
  })

  it('replaces special chars', () => {
    expect(sanitizeToolName('scen/foo:bar')).toBe('scen_foo_bar')
  })

  it('collapses consecutive underscores', () => {
    expect(sanitizeToolName('a  b')).toBe('a_b')
  })

  it('truncates to 64 chars', () => {
    const long = 'a'.repeat(100)
    expect(sanitizeToolName(long).length).toBe(64)
  })

  it('returns fallback for empty string', () => {
    expect(sanitizeToolName('!!!')).toBe('scenario')
  })
})

// ---------------------------------------------------------------------------
// Unit tests: buildInputSchema
// ---------------------------------------------------------------------------

describe('buildInputSchema', () => {
  it('maps string field to JSON Schema string', () => {
    const schema = buildInputSchema([
      { name: 'email', label: 'Email', type: 'string', required: true },
    ])
    expect((schema.properties as Record<string, unknown> & { email: { type: string } }).email.type).toBe('string')
    expect((schema as { required?: string[] }).required).toContain('email')
  })

  it('maps enum field correctly', () => {
    const schema = buildInputSchema([
      { name: 'role', label: 'Role', type: 'enum', enumValues: ['admin', 'user'] },
    ])
    const roleProp = (schema.properties as Record<string, { type: string; enum?: string[] }>).role
    expect(roleProp.type).toBe('string')
    expect(roleProp.enum).toEqual(['admin', 'user'])
  })

  it('maps number field to JSON Schema number', () => {
    const schema = buildInputSchema([
      { name: 'count', label: 'Count', type: 'number', required: true },
    ])
    expect((schema.properties as Record<string, { type: string }>).count.type).toBe('number')
  })

  it('does not add required array when no required fields', () => {
    const schema = buildInputSchema([{ name: 'x', label: 'X', type: 'string' }])
    expect((schema as { required?: string[] }).required).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// Integration: createServer — list tools
// ---------------------------------------------------------------------------

describe('createServer — list tools', () => {
  it('registers one tool per scenario with sanitized names', async () => {
    await withBundleFile(sampleBundle, async (bundlePath) => {
      const server = await createServer({ bundlePath, fetcher: makeFetcher([]) })

      // _registeredTools is a plain object keyed by tool name
      const tools = (server as unknown as { _registeredTools: Record<string, unknown> })
        ._registeredTools
      expect(tools).toBeDefined()

      const toolNames = Object.keys(tools)
      expect(toolNames).toContain('scen-register')
      expect(toolNames).toContain('scen-create-only')
      expect(toolNames).toHaveLength(2)
    })
  })
})

// ---------------------------------------------------------------------------
// Integration: invoke tool against fake fetcher
// ---------------------------------------------------------------------------

describe('createServer — invoke scenario tool', () => {
  it('runs scenario blocks in order and returns captured context', async () => {
    await withBundleFile(sampleBundle, async (bundlePath) => {
      // create-user returns userId, get-profile returns name
      const fetcher = makeFetcher([
        { status: 201, body: { data: { id: 'user-123' } } },
        { status: 200, body: { name: 'Alice' } },
      ])

      const server = await createServer({ bundlePath, fetcher })
      const tools = (server as unknown as { _registeredTools: Record<string, { handler: Function }> })
        ._registeredTools
      const regTool = tools['scen-register']
      expect(regTool).toBeDefined()

      const extra = makeExtra()
      const result = await regTool.handler({ email: 'alice@example.com', role: 'admin' }, extra)

      expect(result.isError).toBeFalsy()
      const parsed = JSON.parse(result.content[0].text)
      expect(parsed.success).toBe(true)
      expect(parsed.blocksRun).toBe(2)
      expect(parsed.context.userId).toBe('user-123')
      expect(parsed.context.userName).toBe('Alice')
    })
  })

  it('returns isError when a block fails', async () => {
    await withBundleFile(sampleBundle, async (bundlePath) => {
      const fetcher = makeFetcher([{ status: 500, body: { error: 'server error' } }])

      const server = await createServer({ bundlePath, fetcher })
      const tools = (server as unknown as { _registeredTools: Record<string, { handler: Function }> })
        ._registeredTools
      const regTool = tools['scen-register']

      const extra = makeExtra()
      const result = await regTool.handler({ email: 'x@y.com' }, extra)

      expect(result.isError).toBe(true)
      const parsed = JSON.parse(result.content[0].text)
      expect(parsed.success).toBe(false)
      expect(parsed.blocks[0].status).toBe('err')
    })
  })

  it('handles unknown block kind gracefully', async () => {
    const badBundle = {
      ...sampleBundle,
      versions: [
        {
          ...sampleBundle.versions[0],
          scenarios: [
            {
              id: 'bad-scen',
              name: 'Bad scenario',
              createdAt: '2026-01-01T00:00:00Z',
              blocks: [{ id: 'x1', kind: 'nonexistent-block', overrides: {} }],
            },
          ],
        },
      ],
    }

    await withBundleFile(badBundle, async (bundlePath) => {
      const server = await createServer({ bundlePath, fetcher: makeFetcher([]) })
      const tools = (server as unknown as { _registeredTools: Record<string, { handler: Function }> })
        ._registeredTools
      const badTool = tools['bad-scen']

      const extra = makeExtra()
      const result = await badTool.handler({}, extra)

      expect(result.isError).toBe(true)
    })
  })

  it('emits progress notifications when progressToken is provided', async () => {
    await withBundleFile(sampleBundle, async (bundlePath) => {
      const fetcher = makeFetcher([
        { status: 201, body: { data: { id: 'u1' } } },
        { status: 200, body: { name: 'Bob' } },
      ])

      const server = await createServer({ bundlePath, fetcher })
      const tools = (server as unknown as { _registeredTools: Record<string, { handler: Function }> })
        ._registeredTools
      const regTool = tools['scen-register']

      const extra = makeExtra()
      extra._meta = { progressToken: 'tok-abc' }
      await regTool.handler({ email: 'bob@example.com' }, extra)

      // sendNotification should have been called once per block (2 blocks)
      expect(extra.sendNotification).toHaveBeenCalledTimes(2)
      const firstCall = extra.sendNotification.mock.calls[0][0]
      expect(firstCall.method).toBe('notifications/progress')
      expect(firstCall.params.progressToken).toBe('tok-abc')
      expect(firstCall.params.total).toBe(2)
    })
  })
})
