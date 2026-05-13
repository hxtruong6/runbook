import { z } from 'zod'

const BlockInstanceSchema = z.object({
  id: z.string(),
  kind: z.string(),
  overrides: z.record(z.string(), z.unknown()),
})

const GraphEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  sourcePort: z.enum(['ok', 'error']),
  target: z.string(),
  condition: z.unknown().optional(),
})

const GraphDataSchema = z.object({
  startNodeId: z.string(),
  nodes: z.array(z.unknown()),
  edges: z.array(GraphEdgeSchema),
})

export const ScenarioDbSchema = z.object({
  projectId: z.string(),
  teamId: z.string(),
  name: z.string().min(1),
  blocks: z.array(BlockInstanceSchema),
  reusable: z.boolean().optional(),
  graphData: GraphDataSchema.optional(),
  updatedAt: z.date(),
  updatedBy: z.string(),
})

export const CreateScenarioSchema = z.object({
  name: z.string().min(1),
  blocks: z.array(BlockInstanceSchema).default([]),
})

export type ScenarioDb = z.infer<typeof ScenarioDbSchema>
export type CreateScenario = z.infer<typeof CreateScenarioSchema>
