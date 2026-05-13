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

  it('POST /teams/:teamId/projects/import creates project and scenarios from bundle', async () => {
    const app = buildApp()
    await app.ready()
    const { token, teamId } = await setupTeam(app, 'import-test-1@example.com')

    const bundle = {
      id: 'bundle-1',
      name: 'My Bundle',
      createdAt: '2026-01-01T00:00:00Z',
      versions: [
        {
          version: '1.0.0',
          releasedAt: '2026-01-01T00:00:00Z',
          releaseNotes: '',
          changes: [],
          blocks: [],
          environments: [],
          docs: {},
          scenarios: [
            {
              id: 'sc-1',
              name: 'Happy path',
              createdAt: '2026-01-01T00:00:00Z',
              blocks: [{ id: 'b1', kind: 'signin', overrides: {} }],
              reusable: false,
            },
          ],
        },
      ],
    }

    const res = await app.inject({
      method: 'POST',
      url: `/teams/${teamId}/projects/import`,
      headers: { authorization: `Bearer ${token}` },
      payload: bundle,
    })

    expect(res.statusCode).toBe(201)
    const body = JSON.parse(res.body) as { project: { name: string }; scenarios: unknown[] }
    expect(body.project.name).toBe('My Bundle')
    expect(body.scenarios.length).toBe(1)
    await app.close()
  })

  it('POST /teams/:teamId/projects/import returns 400 on invalid bundle', async () => {
    const app = buildApp()
    await app.ready()
    const { token, teamId } = await setupTeam(app, 'import-test-2@example.com')

    const res = await app.inject({
      method: 'POST',
      url: `/teams/${teamId}/projects/import`,
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 123, versions: 'bad' }, // invalid
    })

    expect(res.statusCode).toBe(400)
    const body = JSON.parse(res.body) as { error: string; details: string[] }
    expect(body.error).toBe('Invalid bundle')
    expect(Array.isArray(body.details)).toBe(true)
    expect(body.details.length).toBeGreaterThan(0)
    await app.close()
  })
})
