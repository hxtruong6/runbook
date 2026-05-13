import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { startTestDb, stopTestDb, buildApp } from './helpers.js'

async function setupContext(app: Awaited<ReturnType<typeof buildApp>>, email: string) {
  await app.inject({ method: 'POST', url: '/auth/register', payload: { email, name: 'T', password: 'password123' } })
  const loginRes = await app.inject({ method: 'POST', url: '/auth/login', payload: { email, password: 'password123' } })
  const token = (JSON.parse(loginRes.body) as { token: string }).token
  const teamRes = await app.inject({ method: 'POST', url: '/teams', headers: { authorization: `Bearer ${token}` }, payload: { name: `Team ${email}` } })
  const teamId = (JSON.parse(teamRes.body) as { _id: string })._id
  const projRes = await app.inject({ method: 'POST', url: `/teams/${teamId}/projects`, headers: { authorization: `Bearer ${token}` }, payload: { name: 'P' } })
  const projectId = (JSON.parse(projRes.body) as { _id: string })._id
  return { token, teamId, projectId }
}

describe('Scenarios routes', () => {
  beforeAll(() => startTestDb())
  afterAll(() => stopTestDb())

  it('POST creates a scenario', async () => {
    const app = buildApp()
    await app.ready()
    const { token, teamId, projectId } = await setupContext(app, 'sc-1@example.com')
    const res = await app.inject({
      method: 'POST',
      url: `/teams/${teamId}/scenarios`,
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Login Flow', projectId, blocks: [] },
    })
    expect(res.statusCode).toBe(201)
    expect(JSON.parse(res.body)).toMatchObject({ name: 'Login Flow', teamId, projectId })
    await app.close()
  })

  it('GET returns scenarios for the team', async () => {
    const app = buildApp()
    await app.ready()
    const { token, teamId, projectId } = await setupContext(app, 'sc-2@example.com')
    await app.inject({ method: 'POST', url: `/teams/${teamId}/scenarios`, headers: { authorization: `Bearer ${token}` }, payload: { name: 'S', projectId, blocks: [] } })
    const res = await app.inject({ method: 'GET', url: `/teams/${teamId}/scenarios`, headers: { authorization: `Bearer ${token}` } })
    expect(res.statusCode).toBe(200)
    expect(Array.isArray(JSON.parse(res.body))).toBe(true)
    await app.close()
  })

  it('PATCH updates a scenario', async () => {
    const app = buildApp()
    await app.ready()
    const { token, teamId, projectId } = await setupContext(app, 'sc-3@example.com')
    const createRes = await app.inject({ method: 'POST', url: `/teams/${teamId}/scenarios`, headers: { authorization: `Bearer ${token}` }, payload: { name: 'Old Name', projectId, blocks: [] } })
    const scenarioId = (JSON.parse(createRes.body) as { _id: string })._id
    const patch = [{ op: 'replace', path: '/name', value: 'New Name' }]
    const res = await app.inject({ method: 'PATCH', url: `/teams/${teamId}/scenarios/${scenarioId}`, headers: { authorization: `Bearer ${token}` }, payload: patch })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toMatchObject({ name: 'New Name' })
    await app.close()
  })

  it('DELETE removes a scenario', async () => {
    const app = buildApp()
    await app.ready()
    const { token, teamId, projectId } = await setupContext(app, 'sc-4@example.com')
    const createRes = await app.inject({ method: 'POST', url: `/teams/${teamId}/scenarios`, headers: { authorization: `Bearer ${token}` }, payload: { name: 'Delete Me', projectId, blocks: [] } })
    const scenarioId = (JSON.parse(createRes.body) as { _id: string })._id
    const res = await app.inject({ method: 'DELETE', url: `/teams/${teamId}/scenarios/${scenarioId}`, headers: { authorization: `Bearer ${token}` } })
    expect(res.statusCode).toBe(200)
    await app.close()
  })
})
