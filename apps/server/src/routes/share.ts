// apps/server/src/routes/share.ts
import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { getDb } from '../db.js'
import { redactRunResult, redactBundle } from '@runbook/shared'

// ─────────────────────────────────────────────────────────────
// Slug generation — 8-char base62
// ─────────────────────────────────────────────────────────────

const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'

function generateSlug(length = 8): string {
  let slug = ''
  const bytes = new Uint8Array(length)
  // Use Node's crypto globalThis.crypto (available in Node 18+)
  globalThis.crypto.getRandomValues(bytes)
  for (const byte of bytes) {
    slug += BASE62[byte % 62]
  }
  return slug
}

// ─────────────────────────────────────────────────────────────
// Input schema
// ─────────────────────────────────────────────────────────────

const ShareInputSchema = z.object({
  bundleId: z.string().optional(),
  bundle: z.record(z.string(), z.unknown()).optional(),
  scenarioId: z.string().optional(),
  runResult: z.unknown(),
  ttlDays: z.number().int().positive().max(365).default(30),
})

// ─────────────────────────────────────────────────────────────
// Route plugin
// ─────────────────────────────────────────────────────────────

export async function shareRoutes(app: FastifyInstance): Promise<void> {
  // POST /api/share — create a shareable run link
  app.post('/', async (req, reply) => {
    const parsed = ShareInputSchema.safeParse(req.body)
    if (!parsed.success) {
      const details = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
      return reply.code(400).send({ error: 'Invalid share payload', details })
    }

    const { bundleId, bundle, scenarioId, runResult, ttlDays } = parsed.data

    // Redact sensitive data
    const safeRunResult = runResult
      ? redactRunResult(runResult as Parameters<typeof redactRunResult>[0])
      : null
    const safeBundle = bundle ? redactBundle(bundle as Parameters<typeof redactBundle>[0]) : null

    const now = new Date()
    const expiresAt = new Date(now.getTime() + ttlDays * 24 * 60 * 60 * 1000)

    const db = getDb()

    // Generate a unique slug (retry on collision — astronomically unlikely)
    let slug = generateSlug()
    let attempts = 0
    while (attempts < 5) {
      const existing = await db.collection('shares').findOne({ slug })
      if (!existing) break
      slug = generateSlug()
      attempts++
    }

    const payload = {
      bundleId: bundleId ?? null,
      bundle: safeBundle,
      scenarioId: scenarioId ?? null,
      runResult: safeRunResult,
    }

    await db.collection('shares').insertOne({
      slug,
      payload,
      createdAt: now,
      expiresAt,
    })

    const baseUrl = process.env['APP_BASE_URL'] ?? 'http://localhost:3000'
    const url = `${baseUrl}/s/${slug}`

    return reply.code(201).send({ slug, url })
  })

  // GET /api/share/:slug — retrieve a share by slug
  app.get('/:slug', async (req, reply) => {
    const { slug } = req.params as { slug: string }
    const db = getDb()

    const share = await db.collection('shares').findOne({ slug }, { projection: { _id: 0 } })

    if (!share) {
      return reply.code(404).send({ error: 'Share not found' })
    }

    // Check TTL in app code (the TTL index is the primary mechanism, but belt-and-suspenders)
    if (share['expiresAt'] && new Date(share['expiresAt'] as string) < new Date()) {
      return reply.code(404).send({ error: 'Share has expired' })
    }

    return reply.send(share)
  })
}
