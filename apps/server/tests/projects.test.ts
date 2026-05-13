import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { startTestDb, stopTestDb, buildApp } from './helpers.js'

async function setupTeam(app: Awaited<ReturnType<typeof buildApp>>, email: string) {
  await app.inject({
    method: 'POST',
    url: '/auth/register',
    payload: { email, name: 'Test User', password: 'password123' },
  })
  const loginRes = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { email, password: 'password123' },
  })
  const token = (JSON.parse(loginRes.body) as { token: string }).token
  const teamRes = await app.inject({
    method: 'POST',
    url: '/teams',
    headers: { authorization: `Bearer ${token}` },
    payload: { name: `Team for ${email}` },
  })
  const teamId = (JSON.parse(teamRes.body) as { _id: string })._id
  return { token, teamId }
}

describe('Projects routes', () => {
  beforeAll(() => startTestDb())
  afterAll(() => stopTestDb())

  it('POST /teams/:teamId/projects creates a project', async () => {
    const app = buildApp()
    await app.ready()
    const { token, teamId } = await setupTeam(app, 'proj-test-1@example.com')
    const res = await app.inject({
      method: 'POST',
      url: `/teams/${teamId}/projects`,
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'My Project' },
    })
    expect(res.statusCode).toBe(201)
    expect(JSON.parse(res.body)).toMatchObject({ name: 'My Project', teamId })
    await app.close()
  })

  it('GET /teams/:teamId/projects returns projects for team', async () => {
    const app = buildApp()
    await app.ready()
    const { token, teamId } = await setupTeam(app, 'proj-test-2@example.com')
    await app.inject({
      method: 'POST',
      url: `/teams/${teamId}/projects`,
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Project A' },
    })
    const res = await app.inject({
      method: 'GET',
      url: `/teams/${teamId}/projects`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body) as unknown[]
    expect(Array.isArray(body)).toBe(true)
    expect(body.length).toBeGreaterThan(0)
    await app.close()
  })

  it('DELETE /teams/:teamId/projects/:projectId removes project', async () => {
    const app = buildApp()
    await app.ready()
    const { token, teamId } = await setupTeam(app, 'proj-test-3@example.com')
    const createRes = await app.inject({
      method: 'POST',
      url: `/teams/${teamId}/projects`,
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'To Delete' },
    })
    const projectId = (JSON.parse(createRes.body) as { _id: string })._id
    const res = await app.inject({
      method: 'DELETE',
      url: `/teams/${teamId}/projects/${projectId}`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    await app.close()
  })
})
