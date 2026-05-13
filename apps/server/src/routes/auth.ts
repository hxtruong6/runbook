import { FastifyInstance } from 'fastify'
import bcrypt from 'bcryptjs'
import { getDb } from '../db.js'
import { CreateUserSchema } from '@runbook/shared'
import { z } from 'zod'

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
})

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post('/register', async (req, reply) => {
    const body = CreateUserSchema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: 'Invalid input' })

    const db = getDb()
    const existing = await db.collection('users').findOne({ email: body.data.email })
    if (existing) return reply.code(400).send({ error: 'Email already in use' })

    const passwordHash = await bcrypt.hash(body.data.password, 10)
    const result = await db.collection('users').insertOne({
      email: body.data.email,
      name: body.data.name,
      passwordHash,
      createdAt: new Date(),
    })

    const token = app.jwt.sign(
      { sub: result.insertedId.toString(), email: body.data.email },
      { expiresIn: '7d' },
    )
    return reply.code(201).send({ token })
  })

  app.post('/login', async (req, reply) => {
    const body = LoginSchema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: 'Invalid input' })

    const db = getDb()
    const user = await db.collection('users').findOne({ email: body.data.email })
    if (!user) return reply.code(401).send({ error: 'Invalid credentials' })

    const valid = await bcrypt.compare(body.data.password, user['passwordHash'] as string)
    if (!valid) return reply.code(401).send({ error: 'Invalid credentials' })

    const token = app.jwt.sign(
      { sub: user['_id'].toString(), email: user['email'] },
      { expiresIn: '7d' },
    )
    return reply.code(200).send({ token })
  })
}
