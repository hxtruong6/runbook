import { FastifyInstance } from 'fastify'
import { ObjectId } from 'mongodb'
import { getDb } from '../db.js'
import { authenticate } from '../plugins/authenticate.js'
import { CreateTeamSchema } from '@runbook/shared'
import { z } from 'zod'

function toSlug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

const InviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'member']),
})

export async function teamsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', { preHandler: [authenticate] }, async (req, reply) => {
    const user = req.user as { sub: string }
    const db = getDb()
    const memberships = await db
      .collection('memberships')
      .find({ userId: user.sub })
      .toArray()
    const teamIds = memberships.map((m) => new ObjectId(m['teamId'] as string))
    const teams = await db.collection('teams').find({ _id: { $in: teamIds } }).toArray()
    return reply.send(teams)
  })

  app.post('/', { preHandler: [authenticate] }, async (req, reply) => {
    const user = req.user as { sub: string }
    const body = CreateTeamSchema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: 'Invalid input' })

    const db = getDb()
    const slug = toSlug(body.data.name)
    const existing = await db.collection('teams').findOne({ slug })
    if (existing) return reply.code(400).send({ error: 'Team slug already taken' })

    const result = await db.collection('teams').insertOne({
      name: body.data.name,
      slug,
      createdAt: new Date(),
    })
    await db.collection('memberships').insertOne({
      userId: user.sub,
      teamId: result.insertedId.toString(),
      role: 'owner',
    })
    const team = await db.collection('teams').findOne({ _id: result.insertedId })
    return reply.code(201).send(team)
  })

  app.get('/:teamId/members', { preHandler: [authenticate] }, async (req, reply) => {
    const { teamId } = req.params as { teamId: string }
    const user = req.user as { sub: string }
    const db = getDb()
    const membership = await db.collection('memberships').findOne({ userId: user.sub, teamId })
    if (!membership) return reply.code(403).send({ error: 'Forbidden' })
    const members = await db.collection('memberships').find({ teamId }).toArray()

    const userIds = members.map((m) => {
      try { return new ObjectId(m['userId'] as string) } catch { return null }
    }).filter((id): id is ObjectId => id !== null)

    const users = await db.collection('users').find({ _id: { $in: userIds } }).toArray()
    const userMap = new Map(users.map((u) => [u['_id'].toString(), { email: u['email'] as string, name: u['name'] as string | undefined }]))

    const enriched = members.map((m) => {
      const info = userMap.get(m['userId'] as string)
      return { userId: m['userId'], teamId: m['teamId'], role: m['role'], email: info?.email ?? null, name: info?.name ?? null }
    })

    return reply.send(enriched)
  })

  app.post('/:teamId/members', { preHandler: [authenticate] }, async (req, reply) => {
    const { teamId } = req.params as { teamId: string }
    const user = req.user as { sub: string }
    const body = InviteMemberSchema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: 'Invalid input' })

    const db = getDb()
    const requester = await db.collection('memberships').findOne({ userId: user.sub, teamId })
    if (!requester || !['owner', 'admin'].includes(requester['role'] as string)) {
      return reply.code(403).send({ error: 'Forbidden' })
    }
    const invitee = await db.collection('users').findOne({ email: body.data.email })
    if (!invitee) return reply.code(404).send({ error: 'User not found' })

    await db.collection('memberships').updateOne(
      { userId: invitee['_id'].toString(), teamId },
      { $set: { role: body.data.role } },
      { upsert: true },
    )
    return reply.code(201).send({ ok: true })
  })

  app.delete('/:teamId/members/:userId', { preHandler: [authenticate] }, async (req, reply) => {
    const { teamId, userId } = req.params as { teamId: string; userId: string }
    const user = req.user as { sub: string }
    const db = getDb()
    const requester = await db.collection('memberships').findOne({ userId: user.sub, teamId })
    if (!requester || requester['role'] !== 'owner') {
      return reply.code(403).send({ error: 'Forbidden' })
    }
    await db.collection('memberships').deleteOne({ userId, teamId })
    return reply.send({ ok: true })
  })
}
