import { FastifyInstance } from 'fastify'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { z } from 'zod'
import { getDb } from '../db.js'
import { sendPasswordResetEmail } from '../lib/mailer.js'

const ForgotSchema = z.object({ email: z.string().email() })
const ResetSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
})

export async function passwordResetRoutes(app: FastifyInstance): Promise<void> {
  app.post('/forgot-password', async (req, reply) => {
    const body = ForgotSchema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: 'Invalid email' })

    const db = getDb()
    const user = await db.collection('users').findOne({ email: body.data.email })

    // Always return 200 to avoid leaking which emails are registered
    if (!user) return reply.code(200).send({ ok: true })

    // Invalidate any previous reset token for this email
    await db.collection('passwordResets').deleteMany({ email: body.data.email })

    const token = crypto.randomBytes(32).toString('hex')
    await db.collection('passwordResets').insertOne({
      email: body.data.email,
      token,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    })

    const appUrl = process.env['APP_URL'] ?? 'http://localhost:3002'
    const resetUrl = `${appUrl}/#/reset-password?token=${token}`
    await sendPasswordResetEmail(body.data.email, resetUrl)

    return reply.code(200).send({ ok: true })
  })

  app.post('/reset-password', async (req, reply) => {
    const body = ResetSchema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: 'Invalid input' })

    const db = getDb()
    const record = await db.collection('passwordResets').findOne({ token: body.data.token })

    if (!record) return reply.code(400).send({ error: 'Invalid or expired reset link' })
    if (new Date() > new Date(record['expiresAt'] as Date)) {
      await db.collection('passwordResets').deleteOne({ token: body.data.token })
      return reply.code(400).send({ error: 'Reset link has expired' })
    }

    const passwordHash = await bcrypt.hash(body.data.password, 10)
    await db.collection('users').updateOne(
      { email: record['email'] },
      { $set: { passwordHash } },
    )
    await db.collection('passwordResets').deleteOne({ token: body.data.token })

    return reply.code(200).send({ ok: true })
  })
}
