import { describe, it, expect } from 'vitest'
import {
  SECRET_KEY_PATTERN,
  redactHeaders,
  redactQueryString,
  redactObject,
  redactEnvironment,
  redactRunResult,
  redactBundle,
} from '../src/redact.js'

describe('SECRET_KEY_PATTERN', () => {
  it('matches common secret-bearing keys', () => {
    for (const k of ['Authorization', 'cookie', 'api-key', 'API_KEY', 'x-api-key', 'token', 'secret', 'password', 'Bearer']) {
      expect(SECRET_KEY_PATTERN.test(k)).toBe(true)
    }
  })
  it('leaves benign keys alone', () => {
    for (const k of ['content-type', 'accept', 'user-id', 'name']) {
      expect(SECRET_KEY_PATTERN.test(k)).toBe(false)
    }
  })
})

describe('redactHeaders', () => {
  it('matches keys case-insensitively', () => {
    const headers = { Authorization: 'Bearer abc', 'X-API-Key': 'k', 'Content-Type': 'application/json' }
    const out = redactHeaders(headers)
    expect(out['Authorization']).toBe('***')
    expect(out['X-API-Key']).toBe('***')
    expect(out['Content-Type']).toBe('application/json')
  })

  it('handles array-valued headers', () => {
    const headers = { 'Set-Cookie': ['a=1', 'b=2'], Accept: ['json'] }
    const out = redactHeaders(headers)
    expect(out['Set-Cookie']).toEqual(['***', '***'])
    expect(out['Accept']).toEqual(['json'])
  })

  it('returns a new object', () => {
    const headers = { Authorization: 'x', Accept: 'y' }
    const out = redactHeaders(headers)
    expect(out).not.toBe(headers)
    expect(headers.Authorization).toBe('x')
  })
})

describe('redactQueryString', () => {
  it('redacts secret-named params and preserves others', () => {
    const out = redactQueryString('https://api.example.com/v1/users?api_key=xyz&page=2&token=foo')
    const url = new URL(out)
    expect(url.searchParams.get('api_key')).toBe('***')
    expect(url.searchParams.get('token')).toBe('***')
    expect(url.searchParams.get('page')).toBe('2')
  })

  it('returns the input untouched when there are no secrets', () => {
    const input = 'https://api.example.com/?page=1&size=10'
    const out = redactQueryString(input)
    const url = new URL(out)
    expect(url.searchParams.get('page')).toBe('1')
    expect(url.searchParams.get('size')).toBe('10')
  })
})

describe('redactObject', () => {
  it('redacts nested object-in-array-in-object', () => {
    const input = {
      user: { name: 'alice', password: 'p4ss' },
      items: [{ id: 1, token: 't' }, { id: 2, value: 'plain' }],
      meta: { nested: { secret: 's', other: 'ok' } },
    }
    const out = redactObject(input)
    expect(out.user.password).toBe('***')
    expect(out.user.name).toBe('alice')
    expect(out.items[0].token).toBe('***')
    expect(out.items[1].value).toBe('plain')
    expect(out.meta.nested.secret).toBe('***')
    expect(out.meta.nested.other).toBe('ok')
  })

  it('does not mutate the input', () => {
    const input = { token: 't', list: [{ password: 'p' }] }
    const out = redactObject(input)
    expect(out).not.toBe(input)
    expect(out.list).not.toBe(input.list)
    expect(input.token).toBe('t')
    expect(input.list[0].password).toBe('p')
  })

  it('respects extraKeys option', () => {
    const input = { sessionId: 'abc', name: 'x' }
    const out = redactObject(input, { extraKeys: ['sessionId'] })
    expect(out.sessionId).toBe('***')
    expect(out.name).toBe('x')
  })

  it('handles primitives and null', () => {
    expect(redactObject(null)).toBeNull()
    expect(redactObject(42)).toBe(42)
    expect(redactObject('hi')).toBe('hi')
  })
})

describe('redactEnvironment', () => {
  it('redacts bearer token and header secrets', () => {
    const env = {
      id: 'e1',
      name: 'prod',
      baseUrl: 'https://api.example.com',
      auth: { kind: 'bearer' as const, token: 'real-token' },
      headers: { Authorization: 'Bearer real', 'X-Trace': 'ok' },
      createdAt: '2024-01-01',
    }
    const out = redactEnvironment(env)
    expect(out.auth).toEqual({ kind: 'bearer', token: '***' })
    expect(out.headers['Authorization']).toBe('***')
    expect(out.headers['X-Trace']).toBe('ok')
    expect(env.auth.token).toBe('real-token')
  })
})

describe('redactRunResult', () => {
  it('redacts request headers, query, and body password fields (snapshot)', () => {
    const result = {
      status: 'ok' as const,
      httpStatus: 200,
      elapsedMs: 123,
      response: { ok: true, data: { token: 'session-xyz', name: 'alice' } },
      captured: { token: 'abc' },
      request: {
        method: 'POST',
        url: 'https://api.example.com/login?api_key=k&trace=on',
        headers: { Authorization: 'Bearer real', 'Content-Type': 'application/json' },
        body: { username: 'alice', password: 'hunter2' },
      },
    }
    const out = redactRunResult(result)
    expect(out).toMatchSnapshot()
  })

  it('recurses into subResults', () => {
    const result = {
      status: 'ok' as const,
      httpStatus: 200,
      elapsedMs: 1,
      response: {},
      subResults: [
        {
          status: 'ok' as const,
          httpStatus: 200,
          elapsedMs: 1,
          response: { token: 't' },
        },
      ],
    }
    const out = redactRunResult(result)
    expect((out.subResults![0].response as { token: string }).token).toBe('***')
  })
})

describe('redactBundle', () => {
  it('redacts environments and runHistory inside versions', () => {
    const bundle = {
      id: 'b1',
      name: 'demo',
      versions: [
        {
          version: '1.0.0',
          environments: [
            {
              id: 'e1',
              name: 'prod',
              baseUrl: 'https://x',
              auth: { kind: 'apiKey' as const, in: 'header' as const, name: 'X-API-Key', value: 'real' },
              headers: { 'X-API-Key': 'real' },
              createdAt: '2024',
            },
          ],
          runHistory: [
            {
              status: 'ok' as const,
              httpStatus: 200,
              elapsedMs: 5,
              response: { password: 'p' },
            },
          ],
        },
      ],
    }
    const out = redactBundle(bundle)
    expect(out.versions![0].environments![0].auth).toMatchObject({ value: '***' })
    expect(out.versions![0].environments![0].headers['X-API-Key']).toBe('***')
    expect((out.versions![0].runHistory![0].response as { password: string }).password).toBe('***')
  })
})
