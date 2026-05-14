// apps/server/tests/registry.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { startTestDb, stopTestDb, buildApp } from './helpers.js'

const SAMPLE_BUNDLE = {
  id: 'test-bundle-001',
  name: 'Test Bundle',
  description: 'A test bundle',
  createdAt: '2026-01-01T00:00:00.000Z',
  versions: [
    {
      version: '1.0.0',
      releasedAt: '2026-01-01T00:00:00.000Z',
      releaseNotes: 'Initial release',
      changes: [],
      blocks: [],
      scenarios: [],
      environments: [],
      docs: {},
    },
  ],
}

async function registerAndLogin(app: ReturnType<typeof buildApp>, email: string) {
  await app.inject({
    method: 'POST',
    url: '/auth/register',
    payload: { email, name: 'Tester', password: 'password123' },
  })
  const res = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { email, password: 'password123' },
  })
  return (JSON.parse(res.body) as { token: string }).token
}

describe('Registry routes', () => {
  beforeAll(() => startTestDb())
  afterAll(() => stopTestDb())

  describe('POST /registry/publish', () => {
    it('returns 401 without auth', async () => {
      const app = buildApp()
      await app.ready()
      const res = await app.inject({
        method: 'POST',
        url: '/registry/publish',
        payload: SAMPLE_BUNDLE,
      })
      expect(res.statusCode).toBe(401)
      await app.close()
    })

    it('publishes a bundle and returns bundleId + hash', async () => {
      const app = buildApp()
      await app.ready()
      const token = await registerAndLogin(app, 'publisher@example.com')
      const res = await app.inject({
        method: 'POST',
        url: '/registry/publish',
        payload: SAMPLE_BUNDLE,
        headers: { authorization: `Bearer ${token}` },
      })
      expect(res.statusCode).toBe(201)
      const body = JSON.parse(res.body) as { bundleId: string; hash: string; latestVersion: string }
      expect(body.bundleId).toBe('test-bundle-001')
      expect(typeof body.hash).toBe('string')
      expect(body.hash).toHaveLength(64)
      expect(body.latestVersion).toBe('1.0.0')
      await app.close()
    })

    it('returns 400 for invalid bundle', async () => {
      const app = buildApp()
      await app.ready()
      const token = await registerAndLogin(app, 'publisher2@example.com')
      const res = await app.inject({
        method: 'POST',
        url: '/registry/publish',
        payload: { id: '', versions: [] },
        headers: { authorization: `Bearer ${token}` },
      })
      expect(res.statusCode).toBe(400)
      await app.close()
    })
  })

  describe('GET /registry', () => {
    it('lists published bundles without bundle content', async () => {
      const app = buildApp()
      await app.ready()
      const token = await registerAndLogin(app, 'lister@example.com')
      await app.inject({
        method: 'POST',
        url: '/registry/publish',
        payload: { ...SAMPLE_BUNDLE, id: 'list-test-bundle' },
        headers: { authorization: `Bearer ${token}` },
      })
      const res = await app.inject({ method: 'GET', url: '/registry' })
      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body) as unknown[]
      expect(Array.isArray(body)).toBe(true)
      expect(body.length).toBeGreaterThan(0)
      const entry = body[0] as Record<string, unknown>
      expect(entry['bundle']).toBeUndefined()
      expect(entry['bundleId']).toBeDefined()
      await app.close()
    })
  })

  describe('GET /registry/search', () => {
    it('filters bundles by name', async () => {
      const app = buildApp()
      await app.ready()
      const token = await registerAndLogin(app, 'searcher@example.com')
      await app.inject({
        method: 'POST',
        url: '/registry/publish',
        payload: { ...SAMPLE_BUNDLE, id: 'search-unique-xyz', name: 'Unique XYZ Bundle' },
        headers: { authorization: `Bearer ${token}` },
      })
      const res = await app.inject({ method: 'GET', url: '/registry/search?q=Unique+XYZ' })
      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body) as Array<Record<string, unknown>>
      expect(body.some((e) => e['bundleId'] === 'search-unique-xyz')).toBe(true)
      await app.close()
    })
  })

  describe('GET /registry/:bundleId', () => {
    it('returns full bundle and hash', async () => {
      const app = buildApp()
      await app.ready()
      const token = await registerAndLogin(app, 'getter@example.com')
      await app.inject({
        method: 'POST',
        url: '/registry/publish',
        payload: { ...SAMPLE_BUNDLE, id: 'get-test-bundle' },
        headers: { authorization: `Bearer ${token}` },
      })
      const res = await app.inject({ method: 'GET', url: '/registry/get-test-bundle' })
      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body) as Record<string, unknown>
      expect(body['bundleId']).toBe('get-test-bundle')
      expect(body['bundle']).toBeDefined()
      expect(typeof body['hash']).toBe('string')
      await app.close()
    })

    it('returns 404 for unknown bundleId', async () => {
      const app = buildApp()
      await app.ready()
      const res = await app.inject({ method: 'GET', url: '/registry/does-not-exist' })
      expect(res.statusCode).toBe(404)
      await app.close()
    })
  })

  describe('GET /registry/:bundleId/verify', () => {
    it('returns valid:true for correct hash', async () => {
      const app = buildApp()
      await app.ready()
      const token = await registerAndLogin(app, 'verifier@example.com')
      const publishRes = await app.inject({
        method: 'POST',
        url: '/registry/publish',
        payload: { ...SAMPLE_BUNDLE, id: 'verify-test-bundle' },
        headers: { authorization: `Bearer ${token}` },
      })
      const { hash } = JSON.parse(publishRes.body) as { hash: string }
      const res = await app.inject({ method: 'GET', url: `/registry/verify-test-bundle/verify?hash=${hash}` })
      expect(res.statusCode).toBe(200)
      expect(JSON.parse(res.body)).toEqual({ valid: true })
      await app.close()
    })

    it('returns valid:false for wrong hash', async () => {
      const app = buildApp()
      await app.ready()
      const token = await registerAndLogin(app, 'verifier2@example.com')
      await app.inject({
        method: 'POST',
        url: '/registry/publish',
        payload: { ...SAMPLE_BUNDLE, id: 'verify-test-bundle-2' },
        headers: { authorization: `Bearer ${token}` },
      })
      const res = await app.inject({
        method: 'GET',
        url: '/registry/verify-test-bundle-2/verify?hash=0000000000000000000000000000000000000000000000000000000000000000',
      })
      expect(res.statusCode).toBe(200)
      expect(JSON.parse(res.body)).toEqual({ valid: false })
      await app.close()
    })
  })
})
