import { describe, it, expect } from 'vitest'
import { importPostman } from '../../src/import/postman.js'

// ---------------------------------------------------------------------------
// Fixture: 2-folder collection
// ---------------------------------------------------------------------------
const twoFolderCollection = {
  info: {
    name: 'My API',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  item: [
    {
      name: 'Auth',
      item: [
        {
          name: 'Login',
          request: {
            method: 'POST',
            url: { raw: 'https://api.example.com/auth/login' },
            header: [{ key: 'Content-Type', value: 'application/json' }],
            body: {
              mode: 'raw',
              raw: '{"email":"user@example.com","password":"secret"}',
              options: { raw: { language: 'json' } },
            },
          },
        },
        {
          name: 'Logout',
          request: {
            method: 'POST',
            url: { raw: 'https://api.example.com/auth/logout' },
            header: [
              { key: 'Authorization', value: 'Bearer {{token}}' },
            ],
          },
        },
      ],
    },
    {
      name: 'Users',
      item: [
        {
          name: 'List Users',
          request: {
            method: 'GET',
            url: { raw: 'https://api.example.com/users' },
          },
        },
        {
          name: 'Get User',
          request: {
            method: 'GET',
            url: { raw: 'https://api.example.com/users/{{userId}}' },
          },
        },
      ],
    },
  ],
}

// ---------------------------------------------------------------------------
// Fixture: collection using {{baseUrl}} variable
// ---------------------------------------------------------------------------
const baseUrlCollection = {
  info: {
    name: 'Base URL Test',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  variable: [
    { key: 'baseUrl', value: 'https://{{env}}.api.example.com' },
    { key: 'apiVersion', value: 'v2' },
  ],
  item: [
    {
      name: 'Health Check',
      request: {
        method: 'GET',
        url: { raw: '{{baseUrl}}/{{apiVersion}}/health' },
      },
    },
    {
      name: 'Create Resource',
      request: {
        method: 'POST',
        url: { raw: '{{baseUrl}}/{{apiVersion}}/resources' },
        header: [{ key: 'X-Api-Key', value: '{{apiKey}}' }],
        body: {
          mode: 'raw',
          raw: '{"name":"{{resourceName}}"}',
          options: { raw: { language: 'json' } },
        },
      },
    },
  ],
}

// ---------------------------------------------------------------------------
// Fixture: raw-body and form-data requests
// ---------------------------------------------------------------------------
const bodyTypesCollection = {
  info: {
    name: 'Body Types',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  item: [
    {
      name: 'JSON Body',
      request: {
        method: 'POST',
        url: { raw: 'https://api.example.com/items' },
        header: [],
        body: {
          mode: 'raw',
          raw: '{"title":"Hello","count":1}',
          options: { raw: { language: 'json' } },
        },
      },
    },
    {
      name: 'Form Data Upload',
      request: {
        method: 'POST',
        url: { raw: 'https://api.example.com/upload' },
        header: [],
        body: {
          mode: 'formdata',
          formdata: [
            { key: 'username', value: 'admin', type: 'text' },
            { key: 'avatar', type: 'file' },        // file fields are skipped
            { key: 'bio', value: 'Hello', type: 'text', disabled: true }, // disabled skipped
            { key: 'role', value: 'editor', type: 'text' },
          ],
        },
      },
    },
    {
      name: 'URL Encoded',
      request: {
        method: 'POST',
        url: { raw: 'https://api.example.com/form' },
        header: [],
        body: {
          mode: 'urlencoded',
          urlencoded: [
            { key: 'grant_type', value: 'authorization_code' },
            { key: 'code', value: '{{code}}' },
          ],
        },
      },
    },
  ],
}

// ---------------------------------------------------------------------------
// Fixture: Postman environment
// ---------------------------------------------------------------------------
const sampleEnvironment = {
  name: 'Staging',
  values: [
    { key: 'baseUrl', value: 'https://staging.api.example.com', enabled: true },
    { key: 'apiKey', value: 'staging-key-123', enabled: true },
    { key: 'secret', value: 'top-secret', enabled: true, type: 'secret' },
    { key: 'disabled_var', value: 'ignored', enabled: false },
  ],
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('importPostman', () => {
  // --- basic structure ---

  it('returns a valid ProjectBundle shape', () => {
    const bundle = importPostman(twoFolderCollection)
    expect(bundle).toHaveProperty('id')
    expect(bundle).toHaveProperty('name', 'My API')
    expect(bundle).toHaveProperty('createdAt')
    expect(bundle.versions).toHaveLength(1)
    expect(bundle.versions[0]!.version).toBe('1.0.0')
  })

  it('throws on invalid input', () => {
    expect(() => importPostman(null)).toThrow('Invalid Postman collection')
    expect(() => importPostman('string')).toThrow()
    expect(() => importPostman(42)).toThrow()
  })

  // --- 2-folder collection ---

  it('creates one scenario per top-level folder', () => {
    const bundle = importPostman(twoFolderCollection)
    const scenarios = bundle.versions[0]!.scenarios
    expect(scenarios).toHaveLength(2)
    expect(scenarios.map((s) => s.name)).toEqual(['Auth', 'Users'])
  })

  it('scenario names match folder names', () => {
    const bundle = importPostman(twoFolderCollection)
    const names = bundle.versions[0]!.scenarios.map((s) => s.name)
    expect(names).toContain('Auth')
    expect(names).toContain('Users')
  })

  it('blocks are generated for each request in a folder', () => {
    const bundle = importPostman(twoFolderCollection)
    const blocks = bundle.versions[0]!.blocks
    // Auth folder: Login + Logout = 2, Users folder: List Users + Get User = 2
    expect(blocks.length).toBe(4)
  })

  it('Auth scenario has 2 block instances', () => {
    const bundle = importPostman(twoFolderCollection)
    const authScenario = bundle.versions[0]!.scenarios.find((s) => s.name === 'Auth')
    expect(authScenario!.blocks).toHaveLength(2)
  })

  it('detects jwt auth from Authorization header', () => {
    const bundle = importPostman(twoFolderCollection)
    const logoutBlock = bundle.versions[0]!.blocks.find((b) => b.label === 'Logout')
    expect(logoutBlock!.auth).toBe('jwt')
  })

  it('does not expose Authorization header in block headers', () => {
    const bundle = importPostman(twoFolderCollection)
    const logoutBlock = bundle.versions[0]!.blocks.find((b) => b.label === 'Logout')
    expect(logoutBlock!.request.headers?.['Authorization']).toBeUndefined()
  })

  // --- nested folders ---

  it('flattens nested folders with / separator in scenario name', () => {
    const nestedCollection = {
      info: { name: 'Nested', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' },
      item: [
        {
          name: 'Auth',
          item: [
            {
              name: 'OAuth',
              item: [
                {
                  name: 'Get Token',
                  request: {
                    method: 'POST',
                    url: { raw: 'https://auth.example.com/token' },
                  },
                },
              ],
            },
          ],
        },
      ],
    }
    const bundle = importPostman(nestedCollection)
    const scenarioNames = bundle.versions[0]!.scenarios.map((s) => s.name)
    expect(scenarioNames).toContain('Auth / OAuth')
  })

  // --- {{variable}} round-trip ---

  it('preserves {{baseUrl}} variable in URL templates unchanged', () => {
    const bundle = importPostman(baseUrlCollection)
    const blocks = bundle.versions[0]!.blocks
    const healthBlock = blocks.find((b) => b.label === 'Health Check')
    expect(healthBlock!.request.urlTemplate).toContain('{{baseUrl}}')
    expect(healthBlock!.request.urlTemplate).toContain('{{apiVersion}}')
  })

  it('preserves {{resourceName}} in body template unchanged', () => {
    const bundle = importPostman(baseUrlCollection)
    const createBlock = bundle.versions[0]!.blocks.find((b) => b.label === 'Create Resource')
    const bodyTemplate = createBlock!.request.bodyTemplate as Record<string, unknown>
    // JSON-parsed body: value is the string "{{resourceName}}"
    expect(bodyTemplate['name']).toBe('{{resourceName}}')
  })

  it('preserves {{apiKey}} in header values unchanged', () => {
    const bundle = importPostman(baseUrlCollection)
    const createBlock = bundle.versions[0]!.blocks.find((b) => b.label === 'Create Resource')
    expect(createBlock!.request.headers?.['X-Api-Key']).toBe('{{apiKey}}')
  })

  it('preserves {{userId}} in URL of Get User block', () => {
    const bundle = importPostman(twoFolderCollection)
    const getUserBlock = bundle.versions[0]!.blocks.find((b) => b.label === 'Get User')
    expect(getUserBlock!.request.urlTemplate).toContain('{{userId}}')
  })

  // --- body types ---

  it('sets bodyTemplate for raw JSON body', () => {
    const bundle = importPostman(bodyTypesCollection)
    const jsonBlock = bundle.versions[0]!.blocks.find((b) => b.label === 'JSON Body')
    expect(jsonBlock!.request.bodyTemplate).toBeTruthy()
    expect((jsonBlock!.request.bodyTemplate as Record<string, unknown>)['title']).toBe('Hello')
  })

  it('creates body inputs for form-data (skipping file and disabled fields)', () => {
    const bundle = importPostman(bodyTypesCollection)
    const formBlock = bundle.versions[0]!.blocks.find((b) => b.label === 'Form Data Upload')
    // username and role only (avatar=file, bio=disabled)
    const bodyInputs = formBlock!.inputs.filter((i) => i.location === 'body')
    expect(bodyInputs.map((i) => i.name)).toEqual(['username', 'role'])
  })

  it('creates body inputs for urlencoded', () => {
    const bundle = importPostman(bodyTypesCollection)
    const urlEncodedBlock = bundle.versions[0]!.blocks.find((b) => b.label === 'URL Encoded')
    const bodyInputs = urlEncodedBlock!.inputs.filter((i) => i.location === 'body')
    expect(bodyInputs.map((i) => i.name)).toContain('grant_type')
    expect(bodyInputs.map((i) => i.name)).toContain('code')
  })

  it('preserves {{code}} variable in urlencoded input', () => {
    // The variable name stays as-is — the value isn't hardcoded into the block
    const bundle = importPostman(bodyTypesCollection)
    const urlEncodedBlock = bundle.versions[0]!.blocks.find((b) => b.label === 'URL Encoded')
    // block's input for 'code' should exist — the runtime replaces {{code}} when running
    const codeInput = urlEncodedBlock!.inputs.find((i) => i.name === 'code')
    expect(codeInput).toBeDefined()
  })

  // --- top-level requests (no folder) ---

  it('groups top-level requests into "Imported Requests" scenario', () => {
    const flat = {
      info: { name: 'Flat', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' },
      item: [
        {
          name: 'Ping',
          request: { method: 'GET', url: { raw: 'https://api.example.com/ping' } },
        },
        {
          name: 'Version',
          request: { method: 'GET', url: { raw: 'https://api.example.com/version' } },
        },
      ],
    }
    const bundle = importPostman(flat)
    const scenario = bundle.versions[0]!.scenarios[0]
    expect(scenario!.name).toBe('Imported Requests')
    expect(scenario!.blocks).toHaveLength(2)
  })

  // --- environment import ---

  it('merges Postman environment as a RunBook Environment', () => {
    const bundle = importPostman(twoFolderCollection, sampleEnvironment)
    const envs = bundle.versions[0]!.environments
    expect(envs).toHaveLength(1)
    expect(envs[0]!.name).toBe('Staging')
  })

  it('sets baseUrl from environment baseUrl variable', () => {
    const bundle = importPostman(twoFolderCollection, sampleEnvironment)
    const env = bundle.versions[0]!.environments[0]!
    expect(env.baseUrl).toBe('https://staging.api.example.com')
  })

  it('includes non-secret env variables as headers', () => {
    const bundle = importPostman(twoFolderCollection, sampleEnvironment)
    const env = bundle.versions[0]!.environments[0]!
    expect(env.headers['apiKey']).toBe('staging-key-123')
  })

  it('excludes secret-type env variables from headers', () => {
    const bundle = importPostman(twoFolderCollection, sampleEnvironment)
    const env = bundle.versions[0]!.environments[0]!
    expect(env.headers['secret']).toBeUndefined()
  })

  it('excludes disabled env variables', () => {
    const bundle = importPostman(twoFolderCollection, sampleEnvironment)
    const env = bundle.versions[0]!.environments[0]!
    expect(env.headers['disabled_var']).toBeUndefined()
  })

  it('returns empty environments array when no environment provided', () => {
    const bundle = importPostman(twoFolderCollection)
    expect(bundle.versions[0]!.environments).toHaveLength(0)
  })

  // --- outputs ---

  it('every block has lastResponse and lastStatus outputs', () => {
    const bundle = importPostman(twoFolderCollection)
    for (const block of bundle.versions[0]!.blocks) {
      const contextKeys = block.outputs.map((o) => o.contextKey)
      expect(contextKeys).toContain('lastResponse')
      expect(contextKeys).toContain('lastStatus')
    }
  })

  // --- change log ---

  it('version change log records number of imported blocks', () => {
    const bundle = importPostman(twoFolderCollection)
    const change = bundle.versions[0]!.changes[0]
    expect(change!.type).toBe('added')
    expect(change!.summary).toMatch(/4 blocks/)
  })

  // --- tags from folder hierarchy ---

  it('derives single tag from a top-level folder', () => {
    const bundle = importPostman(twoFolderCollection)
    const block = bundle.versions[0]!.blocks.find((b) => b.label === 'Login')!
    expect(block.tags).toEqual(['Auth'])
  })

  it('different folders produce different tags', () => {
    const bundle = importPostman(twoFolderCollection)
    const login = bundle.versions[0]!.blocks.find((b) => b.label === 'Login')!
    const listUsers = bundle.versions[0]!.blocks.find((b) => b.label === 'List Users')!
    expect(login.tags).toEqual(['Auth'])
    expect(listUsers.tags).toEqual(['Users'])
  })

  it('derives nested tags from nested folders', () => {
    const nested = {
      info: {
        name: 'Nested',
        schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
      },
      item: [
        {
          name: 'Admin',
          item: [
            {
              name: 'Users',
              item: [
                {
                  name: 'Delete User',
                  request: {
                    method: 'DELETE',
                    url: { raw: 'https://api.example.com/admin/users/{{id}}' },
                  },
                },
              ],
            },
          ],
        },
      ],
    }
    const bundle = importPostman(nested)
    const block = bundle.versions[0]!.blocks[0]!
    expect(block.tags).toEqual(['Admin', 'Users'])
  })

  it('top-level requests (no folder) have no tags', () => {
    const flat = {
      info: {
        name: 'Flat',
        schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
      },
      item: [
        {
          name: 'Ping',
          request: { method: 'GET', url: { raw: 'https://api.example.com/ping' } },
        },
      ],
    }
    const bundle = importPostman(flat)
    const block = bundle.versions[0]!.blocks[0]!
    expect(block.tags).toBeUndefined()
  })
})
