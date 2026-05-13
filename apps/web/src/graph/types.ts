// src/graph/types.ts
import { z } from "zod";

// Inline definition to avoid circular dependency with scenarios/types.ts
const BlockInstanceSchema = z.object({
  id: z.string(),
  kind: z.string(),
  overrides: z.record(z.string(), z.unknown()),
});

export const EdgeConditionSchema = z.object({
  jsonPath: z.string().min(1),
  operator: z.enum(["eq", "neq", "gt", "lt", "contains"]),
  value: z.unknown(),
});

export const GraphEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  sourcePort: z.enum(["ok", "error"]),
  target: z.string(),
  condition: EdgeConditionSchema.optional(),
});

export const GraphNodeDataSchema = z.object({
  blockInstance: BlockInstanceSchema,
  name: z.string(),
  position: z.object({ x: z.number(), y: z.number() }),
});

export const GraphDataSchema = z.object({
  startNodeId: z.string(),
  nodes: z.array(GraphNodeDataSchema),
  edges: z.array(GraphEdgeSchema),
});

export type EdgeCondition = z.infer<typeof EdgeConditionSchema>;
export type GraphEdge = z.infer<typeof GraphEdgeSchema>;
export type GraphNodeData = z.infer<typeof GraphNodeDataSchema>;
export type GraphData = z.infer<typeof GraphDataSchema>;
