import { z } from 'zod'

export const ProjectDbSchema = z.object({
  teamId: z.string(),
  name: z.string().min(1),
  versions: z.array(z.unknown()),
  createdAt: z.date(),
})

export const CreateProjectSchema = z.object({
  name: z.string().min(1),
})

export type ProjectDb = z.infer<typeof ProjectDbSchema>
export type CreateProject = z.infer<typeof CreateProjectSchema>
