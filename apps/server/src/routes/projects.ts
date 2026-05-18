import { FastifyInstance } from 'fastify'
import { ObjectId } from 'mongodb'
import { z } from 'zod'
import { getDb } from '../db.js'
import { authenticate } from '../plugins/authenticate.js'
import { CreateProjectSchema } from '@runbook/shared'

async function assertMember(db: ReturnType<typeof getDb>, userId: string, teamId: string) {
  return (await db.collection('memberships').findOne({ userId, teamId })) != null
}

export async function projectsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/:teamId/projects', { preHandler: [authenticate] }, async (req, reply) => {
    const { teamId } = req.params as { teamId: string }
    const user = req.user as { sub: string }
    const db = getDb()
    if (!(await assertMember(db, user.sub, teamId))) return reply.code(403).send({ error: 'Forbidden' })
    const projects = await db.collection('projects').find({ teamId }).toArray()
    return reply.send(projects)
  })

  app.post('/:teamId/projects', { preHandler: [authenticate] }, async (req, reply) => {
    const { teamId } = req.params as { teamId: string }
    const user = req.user as { sub: string }
    const body = CreateProjectSchema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: 'Invalid input' })

    const db = getDb()
    if (!(await assertMember(db, user.sub, teamId))) return reply.code(403).send({ error: 'Forbidden' })

    const result = await db.collection('projects').insertOne({
      teamId,
      name: body.data.name,
      versions: [],
      createdAt: new Date(),
    })
    const project = await db.collection('projects').findOne({ _id: result.insertedId })
    return reply.code(201).send(project)
  })

  const BlockInstanceImportSchema = z.object({
    id: z.string(),
    kind: z.string(),
    overrides: z.record(z.string(), z.unknown()),
  })

  const ScenarioImportSchema = z.object({
    id: z.string().optional(),
    name: z.string().min(1),
    blocks: z.array(BlockInstanceImportSchema),
    reusable: z.boolean().optional(),
    graphData: z.unknown().optional(),
  })

  const VersionImportSchema = z.object({
    version: z.string(),
    releasedAt: z.string(),
    releaseNotes: z.string().optional().default(''),
    changes: z.array(z.unknown()).default([]),
    blocks: z.array(z.unknown()).default([]),
    environments: z.array(z.unknown()).default([]),
    docs: z.record(z.string(), z.string()).optional().default({}),
    scenarios: z.array(ScenarioImportSchema),
  })

  const ImportBundleSchema = z.object({
    id: z.string().optional(),
    name: z.string().min(1),
    description: z.string().optional(),
    createdAt: z.string().optional(),
    versions: z.array(VersionImportSchema),
  })

  app.post('/:teamId/projects/import', { preHandler: [authenticate] }, async (req, reply) => {
    const { teamId } = req.params as { teamId: string }
    const user = req.user as { sub: string }
    const db = getDb()

    if (!(await assertMember(db, user.sub, teamId))) return reply.code(403).send({ error: 'Forbidden' })

    const parsed = ImportBundleSchema.safeParse(req.body)
    if (!parsed.success) {
      const details = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
      return reply.code(400).send({ error: 'Invalid bundle', details })
    }

    const bundle = parsed.data

    const projectResult = await db.collection('projects').insertOne({
      teamId,
      name: bundle.name,
      description: bundle.description ?? '',
      createdAt: new Date(),
      versions: bundle.versions.map((v) => ({
        version: v.version,
        releasedAt: v.releasedAt,
        releaseNotes: v.releaseNotes,
        changes: v.changes,
        blocks: v.blocks,
        environments: v.environments,
        docs: v.docs,
      })),
    })

    const projectId = projectResult.insertedId.toString()

    const scenarioDocs = bundle.versions.flatMap((v) =>
      v.scenarios.map((s) => ({
        teamId,
        projectId,
        name: s.name,
        blocks: s.blocks,
        reusable: s.reusable ?? false,
        graphData: s.graphData ?? null,
        updatedAt: new Date(),
        updatedBy: user.sub,
      }))
    )

    let insertedScenarios: unknown[] = []
    if (scenarioDocs.length > 0) {
      const scenarioResult = await db.collection('scenarios').insertMany(scenarioDocs)
      insertedScenarios = Object.values(scenarioResult.insertedIds).map((id, i) => ({
        ...scenarioDocs[i],
        _id: id,
      }))
    }

    const project = await db.collection('projects').findOne({ _id: projectResult.insertedId })

    return reply.code(201).send({ project, scenarios: insertedScenarios })
  })

  // Append a new version to an existing project. Scenarios stay project-level
  // (not duplicated per version), so user data — run history, overrides,
  // inference — is preserved automatically. Only the blocks/envs/docs snapshot
  // gets a new entry in versions[].
  const AppendVersionSchema = z.object({
    version: z.string().min(1),
    releasedAt: z.string().optional(),
    releaseNotes: z.string().optional().default(''),
    changes: z.array(z.unknown()).default([]),
    blocks: z.array(z.unknown()).default([]),
    environments: z.array(z.unknown()).default([]),
    docs: z.record(z.string(), z.string()).optional().default({}),
  })

  app.post('/:teamId/projects/:projectId/versions', { preHandler: [authenticate] }, async (req, reply) => {
    const { teamId, projectId } = req.params as { teamId: string; projectId: string }
    const user = req.user as { sub: string }
    const db = getDb()
    if (!(await assertMember(db, user.sub, teamId))) return reply.code(403).send({ error: 'Forbidden' })

    const parsed = AppendVersionSchema.safeParse(req.body)
    if (!parsed.success) {
      const details = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
      return reply.code(400).send({ error: 'Invalid version', details })
    }

    const project = await db.collection('projects').findOne({ _id: new ObjectId(projectId), teamId })
    if (!project) return reply.code(404).send({ error: 'Not found' })

    const existingVersions = (project.versions ?? []) as Array<{ version: string }>
    if (existingVersions.some((v) => v.version === parsed.data.version)) {
      return reply.code(409).send({ error: `Version "${parsed.data.version}" already exists` })
    }

    const newVersion = {
      version: parsed.data.version,
      releasedAt: parsed.data.releasedAt ?? new Date().toISOString(),
      releaseNotes: parsed.data.releaseNotes,
      changes: parsed.data.changes,
      blocks: parsed.data.blocks,
      environments: parsed.data.environments,
      docs: parsed.data.docs,
    }

    await db.collection('projects').updateOne(
      { _id: new ObjectId(projectId), teamId },
      { $push: { versions: newVersion } as never },
    )

    const updated = await db.collection('projects').findOne({ _id: new ObjectId(projectId), teamId })
    return reply.code(201).send(updated)
  })

  app.get('/:teamId/projects/:projectId', { preHandler: [authenticate] }, async (req, reply) => {
    const { teamId, projectId } = req.params as { teamId: string; projectId: string }
    const user = req.user as { sub: string }
    const db = getDb()
    if (!(await assertMember(db, user.sub, teamId))) return reply.code(403).send({ error: 'Forbidden' })
    const project = await db.collection('projects').findOne({ _id: new ObjectId(projectId), teamId })
    if (!project) return reply.code(404).send({ error: 'Not found' })
    return reply.send(project)
  })

  app.delete('/:teamId/projects/:projectId', { preHandler: [authenticate] }, async (req, reply) => {
    const { teamId, projectId } = req.params as { teamId: string; projectId: string }
    const user = req.user as { sub: string }
    const db = getDb()
    if (!(await assertMember(db, user.sub, teamId))) return reply.code(403).send({ error: 'Forbidden' })
    await db.collection('projects').deleteOne({ _id: new ObjectId(projectId), teamId })
    await db.collection('scenarios').deleteMany({ projectId, teamId })
    return reply.send({ ok: true })
  })
}
