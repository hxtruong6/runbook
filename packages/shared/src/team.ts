import { z } from 'zod'

export const TeamSchema = z.object({
  name: z.string().min(1),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  createdAt: z.date(),
})

export const MembershipSchema = z.object({
  userId: z.string(),
  teamId: z.string(),
  role: z.enum(['owner', 'admin', 'member']),
})

export const CreateTeamSchema = z.object({
  name: z.string().min(1),
})

export type Team = z.infer<typeof TeamSchema>
export type Membership = z.infer<typeof MembershipSchema>
export type MemberRole = Membership['role']
export type CreateTeam = z.infer<typeof CreateTeamSchema>
