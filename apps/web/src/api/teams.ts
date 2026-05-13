import { apiFetch, SERVER_BASE } from './client'

export type ApiTeam = { _id: string; name: string; slug: string; createdAt: string }

export function getTeams(): Promise<ApiTeam[]> {
  return apiFetch<ApiTeam[]>(`${SERVER_BASE}/teams`)
}

export function postTeam(name: string): Promise<ApiTeam> {
  return apiFetch<ApiTeam>(`${SERVER_BASE}/teams`, {
    method: 'POST',
    body: JSON.stringify({ name }),
  })
}
