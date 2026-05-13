import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { startTestDb, stopTestDb, buildApp } from './helpers.js'

describe('Auth routes', () => {
  beforeAll(() => startTestDb())
  afterAll(() => stopTestDb())

  describe('POST /auth/register', () => {
    it('creates a user and returns a JWT', async () => {
      const app = buildApp()
      await app.ready()
      const res = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: { email: 'alice@example.com', name: 'Alice', password: 'password123' },
      })
      expect(res.statusCode).toBe(201)
      const body = JSON.parse(res.body)
      expect(body).toHaveProperty('token')
      expect(typeof body.token).toBe('string')
      await app.close()
    })

    it('returns 400 for duplicate email', async () => {
      const app = buildApp()
      await app.ready()
      await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: { email: 'bob@example.com', name: 'Bob', password: 'password123' },
      })
      const res = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: { email: 'bob@example.com', name: 'Bob', password: 'password123' },
      })
      expect(res.statusCode).toBe(400)
      await app.close()
    })
  })

  describe('POST /auth/login', () => {
    it('returns a JWT for valid credentials', async () => {
      const app = buildApp()
      await app.ready()
      await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: { email: 'carol@example.com', name: 'Carol', password: 'password123' },
      })
      const res = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: 'carol@example.com', password: 'password123' },
      })
      expect(res.statusCode).toBe(200)
      expect(JSON.parse(res.body)).toHaveProperty('token')
      await app.close()
    })

    it('returns 401 for wrong password', async () => {
      const app = buildApp()
      await app.ready()
      await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: { email: 'dave@example.com', name: 'Dave', password: 'password123' },
      })
      const res = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: 'dave@example.com', password: 'wrongpassword' },
      })
      expect(res.statusCode).toBe(401)
      await app.close()
    })
  })
})
