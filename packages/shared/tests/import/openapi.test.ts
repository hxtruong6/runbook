/**
 * Tests for the OpenAPI → ProjectBundle importer.
 *
 * Uses an inline fixture spec to avoid relying on network access.
 * The fixture covers:
 *   - GET / POST operations
 *   - Path, query and header parameters
 *   - requestBody with top-level properties
 *   - All three auth schemes: bearer, apiKey, basic
 *   - Tag grouping (Misc for tag-less operations)
 *   - Server URL variable interpolation
 */

import { describe, it, expect } from 'vitest'
import { importOpenApi } from '../../src/import/openapi.js'

// ---------------------------------------------------------------------------
// Shared minimal fixture
// ---------------------------------------------------------------------------

const minimalFixture = {
  openapi: '3.0.0',
  info: { title: 'Test API', version: '2.0.0', description: 'Test API description' },
  servers: [
    {
      url: 'https://{env}.example.com/v1',
      variables: { env: { default: 'api' } },
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer' },
      apiKeyHeader: { type: 'apiKey', in: 'header', name: 'X-Api-Key' },
      basicAuth: { type: 'http', scheme: 'basic' },
    },
  },
  paths: {
    '/users': {
      get: {
        operationId: 'listUsers',
        summary: 'List users',
        tags: ['Users'],
        parameters: [
          { name: 'limit', in: 'query', schema: { type: 'integer' } },
          { name: 'X-Request-Id', in: 'header', schema: { type: 'string' } },
        ],
        security: [{ bearerAuth: [] }],
      },
      post: {
        operationId: 'createUser',
        summary: 'Create user',
        tags: ['Users'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email'],
                properties: {
                  email: { type: 'string' },
                  role: { type: 'string', enum: ['admin', 'user'] },
                  metadata: { type: 'object' },
                },
              },
            },
          },
        },
        security: [{ bearerAuth: [] }],
      },
    },
    '/users/{userId}': {
      get: {
        operationId: 'getUser',
        summary: 'Get user by ID',
        tags: ['Users'],
        parameters: [
          { name: 'userId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        security: [{ apiKeyHeader: [] }],
      },
      delete: {
        operationId: 'deleteUser',
        summary: 'Delete user',
        tags: ['Users'],
        parameters: [
          { name: 'userId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        security: [{ bearerAuth: [] }],
      },
    },
    '/status': {
      get: {
        operationId: 'getStatus',
        summary: 'Health check',
        // No tags → goes into Misc
        security: [{ basicAuth: [] }],
      },
    },
  },
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

async function parse(fixture: unknown) {
  return importOpenApi(fixture)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('importOpenApi — bundle shape', () => {
  it('returns a valid ProjectBundle with expected top-level fields', async () => {
    const bundle = await parse(minimalFixture)

    expect(bundle.id).toBe('test-api-imported')
    expect(bundle.name).toBe('Test API')
    expect(bundle.description).toBe('Test API description')
    expect(typeof bundle.createdAt).toBe('string')
    expect(Array.isArray(bundle.versions)).toBe(true)
    expect(bundle.versions).toHaveLength(1)
  })

  it('uses the API version from info.version', async () => {
    const bundle = await parse(minimalFixture)
    expect(bundle.versions[0]!.version).toBe('2.0.0')
  })
})

describe('importOpenApi — server URL interpolation', () => {
  it('interpolates server variables using their defaults', async () => {
    const bundle = await parse(minimalFixture)
    const version = bundle.versions[0]!
    const block = version.blocks.find((b) => b.kind === 'list-users')
    expect(block?.request.urlTemplate).toBe('https://api.example.com/v1/users')
  })
})

describe('importOpenApi — block generation', () => {
  it('generates one block per operation (5 operations in fixture)', async () => {
    const bundle = await parse(minimalFixture)
    const blocks = bundle.versions[0]!.blocks
    expect(blocks).toHaveLength(5)
  })

  it('uses operationId as the kind (slugified)', async () => {
    const bundle = await parse(minimalFixture)
    const kinds = bundle.versions[0]!.blocks.map((b) => b.kind)
    expect(kinds).toContain('list-users')
    expect(kinds).toContain('create-user')
    expect(kinds).toContain('get-user')
    expect(kinds).toContain('delete-user')
    expect(kinds).toContain('get-status')
  })

  it('uses summary as the label', async () => {
    const bundle = await parse(minimalFixture)
    const block = bundle.versions[0]!.blocks.find((b) => b.kind === 'list-users')!
    expect(block.label).toBe('List users')
  })

  it('maps GET to correct HTTP method', async () => {
    const bundle = await parse(minimalFixture)
    const block = bundle.versions[0]!.blocks.find((b) => b.kind === 'list-users')!
    expect(block.request.method).toBe('GET')
  })

  it('maps POST to correct HTTP method', async () => {
    const bundle = await parse(minimalFixture)
    const block = bundle.versions[0]!.blocks.find((b) => b.kind === 'create-user')!
    expect(block.request.method).toBe('POST')
  })

  it('maps DELETE to correct HTTP method', async () => {
    const bundle = await parse(minimalFixture)
    const block = bundle.versions[0]!.blocks.find((b) => b.kind === 'delete-user')!
    expect(block.request.method).toBe('DELETE')
  })
})

describe('importOpenApi — parameter handling', () => {
  it('maps query parameters to inputs with location=query', async () => {
    const bundle = await parse(minimalFixture)
    const block = bundle.versions[0]!.blocks.find((b) => b.kind === 'list-users')!
    const limitInput = block.inputs.find((i) => i.name === 'limit')
    expect(limitInput).toBeDefined()
    expect(limitInput?.location).toBe('query')
    expect(limitInput?.type).toBe('number')
  })

  it('maps header parameters to inputs with location=header', async () => {
    const bundle = await parse(minimalFixture)
    const block = bundle.versions[0]!.blocks.find((b) => b.kind === 'list-users')!
    const headerInput = block.inputs.find((i) => i.name === 'X-Request-Id')
    expect(headerInput).toBeDefined()
    expect(headerInput?.location).toBe('header')
  })

  it('maps path parameters to inputs with location=path and required=true', async () => {
    const bundle = await parse(minimalFixture)
    const block = bundle.versions[0]!.blocks.find((b) => b.kind === 'get-user')!
    const userIdInput = block.inputs.find((i) => i.name === 'userId')
    expect(userIdInput).toBeDefined()
    expect(userIdInput?.location).toBe('path')
    expect(userIdInput?.required).toBe(true)
  })
})

describe('importOpenApi — requestBody handling', () => {
  it('flattens top-level properties into separate inputs', async () => {
    const bundle = await parse(minimalFixture)
    const block = bundle.versions[0]!.blocks.find((b) => b.kind === 'create-user')!
    const names = block.inputs.map((i) => i.name)
    expect(names).toContain('email')
    expect(names).toContain('role')
  })

  it('marks required properties as required', async () => {
    const bundle = await parse(minimalFixture)
    const block = bundle.versions[0]!.blocks.find((b) => b.kind === 'create-user')!
    const emailInput = block.inputs.find((i) => i.name === 'email')!
    expect(emailInput.required).toBe(true)
  })

  it('maps enum properties to type=enum with enumValues', async () => {
    const bundle = await parse(minimalFixture)
    const block = bundle.versions[0]!.blocks.find((b) => b.kind === 'create-user')!
    const roleInput = block.inputs.find((i) => i.name === 'role')!
    expect(roleInput.type).toBe('enum')
    expect(roleInput.enumValues).toEqual(['admin', 'user'])
  })

  it('passes nested object properties through as a json body field', async () => {
    const bundle = await parse(minimalFixture)
    const block = bundle.versions[0]!.blocks.find((b) => b.kind === 'create-user')!
    const metaInput = block.inputs.find((i) => i.name === 'metadata')!
    expect(metaInput.type).toBe('json')
  })
})

describe('importOpenApi — scenario grouping by tag', () => {
  it('groups operations under their first tag', async () => {
    const bundle = await parse(minimalFixture)
    const version = bundle.versions[0]!
    const usersScenario = version.scenarios.find((s) => s.name === 'Users')
    expect(usersScenario).toBeDefined()
    // Should have 4 operations under "Users"
    expect(usersScenario!.blocks).toHaveLength(4)
  })

  it('puts tag-less operations in a Misc scenario', async () => {
    const bundle = await parse(minimalFixture)
    const version = bundle.versions[0]!
    const miscScenario = version.scenarios.find((s) => s.name === 'Misc')
    expect(miscScenario).toBeDefined()
    expect(miscScenario!.blocks).toHaveLength(1)
  })

  it('each scenario block has the correct kind', async () => {
    const bundle = await parse(minimalFixture)
    const version = bundle.versions[0]!
    const miscScenario = version.scenarios.find((s) => s.name === 'Misc')!
    expect(miscScenario.blocks[0]!.kind).toBe('get-status')
  })
})

describe('importOpenApi — environment generation', () => {
  it('generates one Environment per security scheme', async () => {
    const bundle = await parse(minimalFixture)
    const envs = bundle.versions[0]!.environments
    expect(envs).toHaveLength(3)
  })

  it('generates bearer env for http bearer scheme', async () => {
    const bundle = await parse(minimalFixture)
    const envs = bundle.versions[0]!.environments
    const bearerEnv = envs.find((e) => e.name === 'bearerAuth')!
    expect(bearerEnv).toBeDefined()
    expect(bearerEnv.auth.kind).toBe('bearer')
    expect((bearerEnv.auth as { kind: 'bearer'; token: string }).token).toBe('<set me>')
  })

  it('generates apiKey env for apiKey scheme (in header)', async () => {
    const bundle = await parse(minimalFixture)
    const envs = bundle.versions[0]!.environments
    const apiKeyEnv = envs.find((e) => e.name === 'apiKeyHeader')!
    expect(apiKeyEnv).toBeDefined()
    expect(apiKeyEnv.auth.kind).toBe('apiKey')
    const auth = apiKeyEnv.auth as { kind: 'apiKey'; in: string; name: string; value: string }
    expect(auth.in).toBe('header')
    expect(auth.name).toBe('X-Api-Key')
    expect(auth.value).toBe('<set me>')
  })

  it('generates basic env for http basic scheme', async () => {
    const bundle = await parse(minimalFixture)
    const envs = bundle.versions[0]!.environments
    const basicEnv = envs.find((e) => e.name === 'basicAuth')!
    expect(basicEnv).toBeDefined()
    expect(basicEnv.auth.kind).toBe('basic')
    const auth = basicEnv.auth as { kind: 'basic'; username: string; password: string }
    expect(auth.username).toBe('<set me>')
    expect(auth.password).toBe('<set me>')
  })

  it('sets baseUrl on each environment from servers[0]', async () => {
    const bundle = await parse(minimalFixture)
    const envs = bundle.versions[0]!.environments
    for (const env of envs) {
      expect(env.baseUrl).toBe('https://api.example.com/v1')
    }
  })
})

describe('importOpenApi — edge cases', () => {
  it('returns empty bundle for spec with no paths', async () => {
    const emptySpec = {
      openapi: '3.0.0',
      info: { title: 'Empty', version: '1.0.0' },
    }
    const bundle = await importOpenApi(emptySpec)
    expect(bundle.versions[0]!.blocks).toHaveLength(0)
    expect(bundle.versions[0]!.scenarios).toHaveLength(0)
    expect(bundle.versions[0]!.environments).toHaveLength(0)
  })

  it('handles no servers by leaving urlTemplate without base', async () => {
    const specNoServer = {
      openapi: '3.0.0',
      info: { title: 'No Server', version: '1.0.0' },
      paths: {
        '/ping': {
          get: {
            operationId: 'ping',
            summary: 'Ping',
          },
        },
      },
    }
    const bundle = await importOpenApi(specNoServer)
    const block = bundle.versions[0]!.blocks[0]!
    expect(block.request.urlTemplate).toBe('/ping')
  })

  it('falls back to method+path as kind when operationId is absent', async () => {
    const specNoOpId = {
      openapi: '3.0.0',
      info: { title: 'NoId', version: '1.0.0' },
      paths: {
        '/items': {
          post: {
            summary: 'Create item',
          },
        },
      },
    }
    const bundle = await importOpenApi(specNoOpId)
    const block = bundle.versions[0]!.blocks[0]!
    expect(block.kind).toBe('post-items')
  })

  it('generates no environments when no securitySchemes defined', async () => {
    const specNoAuth = {
      openapi: '3.0.0',
      info: { title: 'Public', version: '1.0.0' },
      paths: {
        '/public': {
          get: { operationId: 'public', summary: 'Public endpoint' },
        },
      },
    }
    const bundle = await importOpenApi(specNoAuth)
    expect(bundle.versions[0]!.environments).toHaveLength(0)
  })
})

describe('importOpenApi — auth inference on blocks', () => {
  it('sets auth=jwt for bearer-secured operation', async () => {
    const bundle = await parse(minimalFixture)
    const block = bundle.versions[0]!.blocks.find((b) => b.kind === 'list-users')!
    expect(block.auth).toBe('jwt')
  })

  it('sets auth=jwt for apiKey-secured operation', async () => {
    const bundle = await parse(minimalFixture)
    const block = bundle.versions[0]!.blocks.find((b) => b.kind === 'get-user')!
    expect(block.auth).toBe('jwt')
  })

  it('sets auth=none for operation with no security', async () => {
    const bundle = await parse(minimalFixture)
    const block = bundle.versions[0]!.blocks.find((b) => b.kind === 'get-status')!
    // basic auth maps to none
    expect(block.auth).toBe('none')
  })
})

describe('importOpenApi — block tags', () => {
  it('copies operation.tags onto block.tags', async () => {
    const bundle = await parse(minimalFixture)
    const block = bundle.versions[0]!.blocks.find((b) => b.kind === 'list-users')!
    expect(block.tags).toEqual(['Users'])
  })

  it('falls back to first path segment when no operation tags', async () => {
    const bundle = await parse(minimalFixture)
    const block = bundle.versions[0]!.blocks.find((b) => b.kind === 'get-status')!
    // /status has no tags, so falls back to 'status'
    expect(block.tags).toEqual(['status'])
  })

  it('fallback skips version-like segments (v1, v2, api)', async () => {
    const fixture = {
      openapi: '3.0.0',
      info: { title: 'X', version: '1.0.0' },
      servers: [{ url: 'https://api.example.com' }],
      paths: {
        '/v1/widgets': {
          get: { operationId: 'listWidgets', responses: { '200': { description: 'ok' } } },
        },
      },
    }
    const bundle = await parse(fixture)
    const block = bundle.versions[0]!.blocks[0]!
    expect(block.tags).toEqual(['widgets'])
  })

  it('does NOT add path segment as extra tag when operation already has tags', async () => {
    const bundle = await parse(minimalFixture)
    const block = bundle.versions[0]!.blocks.find((b) => b.kind === 'list-users')!
    // /v1/users — should NOT contain 'v1' or 'users' on top of 'Users'
    expect(block.tags).toEqual(['Users'])
  })
})
