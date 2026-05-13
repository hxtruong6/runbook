import { apiFetch, SERVER_BASE } from './client'
import type { BlockInstance } from '../scenarios/types'
import type { GraphData } from '../graph/types'

export type ApiScenario = {
  _id: string
  projectId: string
  teamId: string
  name: string
  blocks: BlockInstance[]
  reusable?: boolean
  graphData?: GraphData
  updatedAt: string
  updatedBy: string
}

type PatchOp = { op: 'replace' | 'add' | 'remove'; path: string; value?: unknown }

export function getScenarios(teamId: string, projectId: string): Promise<ApiScenario[]> {
  return apiFetch<ApiScenario[]>(`${SERVER_BASE}/teams/${teamId}/scenarios?projectId=${projectId}`)
}

export function postScenario(
  teamId: string,
  data: { projectId: string; name: string; blocks?: BlockInstance[]; reusable?: boolean; graphData?: GraphData }
): Promise<ApiScenario> {
  return apiFetch<ApiScenario>(`${SERVER_BASE}/teams/${teamId}/scenarios`, {
    method: 'POST',
    body: JSON.stringify({ ...data, blocks: data.blocks ?? [] }),
  })
}

export function patchScenario(
  teamId: string,
  scenarioId: string,
  fields: { name?: string; blocks?: BlockInstance[]; reusable?: boolean; graphData?: GraphData | null }
): Promise<ApiScenario> {
  const ops: PatchOp[] = []
  if (fields.name !== undefined) ops.push({ op: 'replace', path: '/name', value: fields.name })
  if (fields.blocks !== undefined) ops.push({ op: 'replace', path: '/blocks', value: fields.blocks })
  if (fields.reusable !== undefined) ops.push({ op: 'replace', path: '/reusable', value: fields.reusable })
  if (fields.graphData !== undefined) ops.push({ op: 'replace', path: '/graphData', value: fields.graphData })
  return apiFetch<ApiScenario>(`${SERVER_BASE}/teams/${teamId}/scenarios/${scenarioId}`, {
    method: 'PATCH',
    body: JSON.stringify(ops),
  })
}

export function deleteScenario(teamId: string, scenarioId: string): Promise<void> {
  return apiFetch<void>(`${SERVER_BASE}/teams/${teamId}/scenarios/${scenarioId}`, { method: 'DELETE' })
}
