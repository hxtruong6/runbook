import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { startTestDb, stopTestDb, buildApp } from './helpers.js'

describe('GET /health', () => {
  beforeAll(() => startTestDb())
  afterAll(() => stopTestDb())

  it('returns status ok', async () => {
    const app = buildApp()
    await app.ready()
    const res = await app.inject({ method: 'GET', url: '/health' })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toEqual({ status: 'ok' })
    await app.close()
  })
})
