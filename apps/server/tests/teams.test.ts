import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { startTestDb, stopTestDb, buildApp } from './helpers.js'

async function registerAndLogin(app: Awaited<ReturnType<typeof buildApp>>, email: string) {
  await app.inject({
    method: 'POST',
    url: '/auth/register',
    payload: { email, name: 'Test User', password: 'password123' },
  })
  const res = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { email, password: 'password123' },
  })
  return (JSON.parse(res.body) as { token: string }).token
}

describe('Teams routes', () => {
  beforeAll(() => startTestDb())
  afterAll(() => stopTestDb())

  it('POST /teams creates a team and returns it', async () => {
    const app = buildApp()
    await app.ready()
    const token = await registerAndLogin(app, 'team-test-1@example.com')
    const res = await app.inject({
      method: 'POST',
      url: '/teams',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Acme Corp' },
    })
    expect(res.statusCode).toBe(201)
    const body = JSON.parse(res.body)
    expect(body.name).toBe('Acme Corp')
    expect(body.slug).toBe('acme-corp')
    expect(body._id).toBeDefined()
    await app.close()
  })

  it('GET /teams returns teams for the current user', async () => {
    const app = buildApp()
    await app.ready()
    const token = await registerAndLogin(app, 'team-test-2@example.com')
    await app.inject({
      method: 'POST',
      url: '/teams',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'My Team' },
    })
    const res = await app.inject({
      method: 'GET',
      url: '/teams',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body) as unknown[]
    expect(Array.isArray(body)).toBe(true)
    expect(body.length).toBeGreaterThan(0)
    await app.close()
  })

  it('POST /teams/:teamId/members invites a member', async () => {
    const app = buildApp()
    await app.ready()
    const ownerToken = await registerAndLogin(app, 'team-owner@example.com')
    await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'new-member@example.com', name: 'New Member', password: 'password123' },
    })
    const teamRes = await app.inject({
      method: 'POST',
      url: '/teams',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { name: 'Invite Team' },
    })
    const teamId = (JSON.parse(teamRes.body) as { _id: string })._id
    const res = await app.inject({
      method: 'POST',
      url: `/teams/${teamId}/members`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { email: 'new-member@example.com', role: 'member' },
    })
    expect(res.statusCode).toBe(201)
    await app.close()
  })
})
