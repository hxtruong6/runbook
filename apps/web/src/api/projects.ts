import { apiFetch, SERVER_BASE, ApiError } from './client'
import type { ProjectBundle, ChangeEntry } from '../projects/types'

export type ApiProjectVersion = {
  version: string
  releasedAt: string
  releaseNotes: string
  changes: ChangeEntry[]
  blocks: unknown[]
  environments: unknown[]
  docs: Record<string, string>
}

export type ApiProject = {
  _id: string
  teamId: string
  name: string
  createdAt: string
  versions?: ApiProjectVersion[]
}
export type ImportResult = { project: ApiProject; scenarios: unknown[] }

export function getProjects(teamId: string): Promise<ApiProject[]> {
  return apiFetch<ApiProject[]>(`${SERVER_BASE}/teams/${teamId}/projects`)
}

export function deleteProject(teamId: string, projectId: string): Promise<void> {
  return apiFetch<void>(`${SERVER_BASE}/teams/${teamId}/projects/${projectId}`, { method: 'DELETE' })
}

export async function postImportBundle(teamId: string, bundle: ProjectBundle): Promise<ImportResult> {
  return apiFetch<ImportResult>(`${SERVER_BASE}/teams/${teamId}/projects/import`, {
    method: 'POST',
    body: JSON.stringify(bundle),
  })
}

export { ApiError }
