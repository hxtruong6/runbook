import { z } from 'zod'

export const UserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  passwordHash: z.string(),
  createdAt: z.date(),
})

export const CreateUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(8),
})

export type User = z.infer<typeof UserSchema>
export type CreateUser = z.infer<typeof CreateUserSchema>
