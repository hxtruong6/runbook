import { FastifyInstance } from 'fastify'
import { ObjectId } from 'mongodb'
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
