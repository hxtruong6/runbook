// src/scenarios/types.ts
import { z } from "zod";

export const BlockInstanceSchema = z.object({
  id: z.string(),
  kind: z.string(),
  overrides: z.record(z.string(), z.unknown()),
});

export const ScenarioSchema = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.string(),
  blocks: z.array(BlockInstanceSchema),
});

export const ScenariosSchema = z.array(ScenarioSchema);

export type BlockInstance = z.infer<typeof BlockInstanceSchema>;
export type Scenario = z.infer<typeof ScenarioSchema>;
