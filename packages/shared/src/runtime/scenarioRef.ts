import { z } from 'zod'

export const SCENARIO_REF_KIND = 'scenario-ref'

export const ScenarioRefOverridesSchema = z.object({
  scenarioId: z.string().min(1),
  continueOnError: z.boolean().optional().default(false),
  contextOverrides: z.record(z.string(), z.unknown()).optional(),
})

export type ScenarioRefOverrides = z.infer<typeof ScenarioRefOverridesSchema>

export function parseScenarioRefOverrides(raw: unknown): ScenarioRefOverrides {
  return ScenarioRefOverridesSchema.parse(raw)
}
