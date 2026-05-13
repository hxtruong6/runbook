import { FastifyInstance } from 'fastify'
import { ObjectId } from 'mongodb'
import { applyPatch, Operation } from 'fast-json-patch'
import { getDb } from '../db.js'
import { authenticate } from '../plugins/authenticate.js'
import { z } from 'zod'

const CreateScenarioBodySchema = z.object({
  name: z.string().min(1),
  projectId: z.string(),
  blocks: z.array(z.unknown()).default([]),
  reusable: z.boolean().optional(),
  graphData: z.unknown().optional(),
})

async function assertMember(db: ReturnType<typeof getDb>, userId: string, teamId: string) {
  return (await db.collection('memberships').findOne({ userId, teamId })) != null
}

export async function scenariosRoutes(app: FastifyInstance): Promise<void> {
  app.get('/:teamId/scenarios', { preHandler: [authenticate] }, async (req, reply) => {
    const { teamId } = req.params as { teamId: string }
    const { projectId } = req.query as { projectId?: string }
    const user = req.user as { sub: string }
    const db = getDb()
    if (!(await assertMember(db, user.sub, teamId))) return reply.code(403).send({ error: 'Forbidden' })
    const filter: Record<string, unknown> = { teamId }
    if (projectId) filter['projectId'] = projectId
    const scenarios = await db.collection('scenarios').find(filter).toArray()
    return reply.send(scenarios)
  })

  app.post('/:teamId/scenarios', { preHandler: [authenticate] }, async (req, reply) => {
    const { teamId } = req.params as { teamId: string }
    const user = req.user as { sub: string }
    const body = CreateScenarioBodySchema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: 'Invalid input' })

    const db = getDb()
    if (!(await assertMember(db, user.sub, teamId))) return reply.code(403).send({ error: 'Forbidden' })

    const result = await db.collection('scenarios').insertOne({
      teamId,
      projectId: body.data.projectId,
      name: body.data.name,
      blocks: body.data.blocks,
      reusable: body.data.reusable ?? false,
      graphData: body.data.graphData ?? null,
      updatedAt: new Date(),
      updatedBy: user.sub,
    })
    const scenario = await db.collection('scenarios').findOne({ _id: result.insertedId })
    return reply.code(201).send(scenario)
  })

  app.get('/:teamId/scenarios/:scenarioId', { preHandler: [authenticate] }, async (req, reply) => {
    const { teamId, scenarioId } = req.params as { teamId: string; scenarioId: string }
    const user = req.user as { sub: string }
    const db = getDb()
    if (!(await assertMember(db, user.sub, teamId))) return reply.code(403).send({ error: 'Forbidden' })
    const scenario = await db.collection('scenarios').findOne({ _id: new ObjectId(scenarioId), teamId })
    if (!scenario) return reply.code(404).send({ error: 'Not found' })
    return reply.send(scenario)
  })

  app.patch('/:teamId/scenarios/:scenarioId', { preHandler: [authenticate] }, async (req, reply) => {
    const { teamId, scenarioId } = req.params as { teamId: string; scenarioId: string }
    const user = req.user as { sub: string }
    const db = getDb()
    if (!(await assertMember(db, user.sub, teamId))) return reply.code(403).send({ error: 'Forbidden' })

    const scenario = await db.collection('scenarios').findOne({ _id: new ObjectId(scenarioId), teamId })
    if (!scenario) return reply.code(404).send({ error: 'Not found' })

    const patch = req.body as Operation[]
    const patched = applyPatch(scenario, patch, false, false).newDocument
    // applyPatch serializes ObjectId to string — restore the original ObjectId
    // Also restore immutable fields to prevent privilege escalation via PATCH
    patched['_id'] = new ObjectId(scenarioId)
    patched['teamId'] = scenario['teamId']
    patched['projectId'] = scenario['projectId']
    patched['updatedAt'] = new Date()
    patched['updatedBy'] = user.sub

    await db.collection('scenarios').replaceOne({ _id: new ObjectId(scenarioId) }, patched)
    return reply.send(patched)
  })

  app.delete('/:teamId/scenarios/:scenarioId', { preHandler: [authenticate] }, async (req, reply) => {
    const { teamId, scenarioId } = req.params as { teamId: string; scenarioId: string }
    const user = req.user as { sub: string }
    const db = getDb()
    if (!(await assertMember(db, user.sub, teamId))) return reply.code(403).send({ error: 'Forbidden' })
    await db.collection('scenarios').deleteOne({ _id: new ObjectId(scenarioId), teamId })
    return reply.send({ ok: true })
  })
}
