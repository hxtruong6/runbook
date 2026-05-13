import { create } from 'zustand'
import {
  getScenarios, postScenario, patchScenario,
  deleteScenario as apiDelete, type ApiScenario,
} from '../api/scenarios'
import type { Scenario } from './types'
import type { BlockInstance } from './types'
import type { GraphData } from '../graph/types'

export function toScenario(a: ApiScenario): Scenario {
  return {
    id: a._id,
    name: a.name,
    createdAt: a.updatedAt,
    blocks: a.blocks,
    reusable: a.reusable ?? false,
    graphData: a.graphData,
  }
}

type ScenariosState = {
  scenarios: Scenario[]
  loading: boolean
  error: string | null
  fetchScenarios: (teamId: string, projectId: string) => Promise<void>
  createScenario: (teamId: string, projectId: string, name: string) => Promise<Scenario>
  updateScenario: (teamId: string, scenario: Scenario) => Promise<void>
  deleteScenario: (teamId: string, scenarioId: string) => Promise<void>
  reset: () => void
}

export const useScenariosStore = create<ScenariosState>()((set, get) => ({
  scenarios: [],
  loading: false,
  error: null,

  async fetchScenarios(teamId, projectId) {
    set({ loading: true, error: null })
    try {
      const raw = await getScenarios(teamId, projectId)
      set({ scenarios: raw.map(toScenario), loading: false })
    } catch (e) {
      set({ loading: false, error: (e as Error).message })
    }
  },

  async createScenario(teamId, projectId, name) {
    const raw = await postScenario(teamId, { projectId, name })
    const scenario = toScenario(raw)
    set((s) => ({ scenarios: [...s.scenarios, scenario] }))
    return scenario
  },

  async updateScenario(teamId, scenario) {
    const prev = get().scenarios
    set((s) => ({
      scenarios: s.scenarios.map((sc) => sc.id === scenario.id ? scenario : sc),
    }))
    try {
      const updated = await patchScenario(teamId, scenario.id, {
        name: scenario.name,
        blocks: scenario.blocks as BlockInstance[],
        reusable: scenario.reusable,
        graphData: scenario.graphData as GraphData | undefined,
      })
      set((s) => ({
        scenarios: s.scenarios.map((sc) => sc.id === scenario.id ? toScenario(updated) : sc),
      }))
    } catch (e) {
      set({ scenarios: prev, error: e instanceof Error ? e.message : 'Update failed' })
    }
  },

  async deleteScenario(teamId, scenarioId) {
    await apiDelete(teamId, scenarioId)
    set((s) => ({ scenarios: s.scenarios.filter((sc) => sc.id !== scenarioId) }))
  },

  reset() {
    set({ scenarios: [], error: null })
  },
}))
