import { apiFetch, SERVER_BASE } from './client'

export type ApiTeam = { _id: string; name: string; slug: string; createdAt: string }
export type ApiMember = { userId: string; teamId: string; role: 'owner' | 'admin' | 'member'; email: string | null; name: string | null }

export function getTeams(): Promise<ApiTeam[]> {
  return apiFetch<ApiTeam[]>(`${SERVER_BASE}/teams`)
}

export function postTeam(name: string): Promise<ApiTeam> {
  return apiFetch<ApiTeam>(`${SERVER_BASE}/teams`, {
    method: 'POST',
    body: JSON.stringify({ name }),
  })
}

export function getMembers(teamId: string): Promise<ApiMember[]> {
  return apiFetch<ApiMember[]>(`${SERVER_BASE}/teams/${teamId}/members`)
}

export function inviteMember(teamId: string, email: string, role: 'admin' | 'member'): Promise<void> {
  return apiFetch<void>(`${SERVER_BASE}/teams/${teamId}/members`, {
    method: 'POST',
    body: JSON.stringify({ email, role }),
  })
}

export function removeMember(teamId: string, userId: string): Promise<void> {
  return apiFetch<void>(`${SERVER_BASE}/teams/${teamId}/members/${userId}`, {
    method: 'DELETE',
  })
}
