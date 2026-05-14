// apps/server/src/routes/registry.ts
import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { getDb } from '../db.js'
import { authenticate } from '../plugins/authenticate.js'
import { computeBundleHash, verifyBundleHash } from '../lib/bundleHash.js'

const BundleVersionSchema = z.object({
  version: z.string(),
  releasedAt: z.string(),
  releaseNotes: z.string().optional().default(''),
  changes: z.array(z.unknown()).default([]),
  blocks: z.array(z.unknown()).default([]),
  scenarios: z.array(z.unknown()).default([]),
  environments: z.array(z.unknown()).default([]),
  docs: z.record(z.string(), z.string()).optional().default({}),
})

const PublishBundleSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional().default(''),
  createdAt: z.string().optional().default(() => new Date().toISOString()),
  versions: z.array(BundleVersionSchema).min(1),
})

function getLatestVersion(versions: Array<{ version: string }>): string {
  return versions[versions.length - 1].version
}

export async function registryRoutes(app: FastifyInstance): Promise<void> {
  // POST /registry/publish — auth required
  app.post('/publish', { preHandler: [authenticate] }, async (req, reply) => {
    const user = req.user as { sub: string }
    const parsed = PublishBundleSchema.safeParse(req.body)
    if (!parsed.success) {
      const details = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
      return reply.code(400).send({ error: 'Invalid bundle', details })
    }

    const bundle = parsed.data
    const hash = computeBundleHash(bundle)
    const latestVersion = getLatestVersion(bundle.versions)
    const db = getDb()

    await db.collection('registry_bundles').updateOne(
      { bundleId: bundle.id },
      {
        $set: {
          bundleId: bundle.id,
          name: bundle.name,
          description: bundle.description,
          publisherId: user.sub,
          hash,
          bundle,
          publishedAt: new Date(),
          latestVersion,
        },
      },
      { upsert: true }
    )

    return reply.code(201).send({ bundleId: bundle.id, hash, latestVersion })
  })

  // GET /registry — public list (metadata only)
  app.get('/', async (_req, reply) => {
    const db = getDb()
    const entries = await db
      .collection('registry_bundles')
      .find({}, { projection: { bundle: 0, _id: 0 } })
      .sort({ publishedAt: -1 })
      .toArray()
    return reply.send(entries)
  })

  // GET /registry/search?q= — public name search
  app.get('/search', async (req, reply) => {
    const { q } = req.query as { q?: string }
    const db = getDb()
    const filter = q ? { name: { $regex: q, $options: 'i' } } : {}
    const entries = await db
      .collection('registry_bundles')
      .find(filter, { projection: { bundle: 0, _id: 0 } })
      .sort({ publishedAt: -1 })
      .limit(50)
      .toArray()
    return reply.send(entries)
  })

  // GET /registry/:bundleId — public, full bundle + hash
  app.get('/:bundleId', async (req, reply) => {
    const { bundleId } = req.params as { bundleId: string }
    const db = getDb()
    const entry = await db.collection('registry_bundles').findOne(
      { bundleId },
      { projection: { _id: 0 } }
    )
    if (!entry) return reply.code(404).send({ error: 'Not found' })
    return reply.send(entry)
  })

  // GET /registry/:bundleId/verify?hash= — public hash verification
  app.get('/:bundleId/verify', async (req, reply) => {
    const { bundleId } = req.params as { bundleId: string }
    const { hash } = req.query as { hash?: string }
    if (!hash) return reply.code(400).send({ error: 'hash query param required' })

    const db = getDb()
    const entry = await db.collection('registry_bundles').findOne({ bundleId })
    if (!entry) return reply.code(404).send({ error: 'Not found' })

    const valid = verifyBundleHash(entry['bundle'], hash)
    return reply.send({ valid })
  })
}
