import { apiFetch, SERVER_BASE } from './client'
import type { ProjectBundle } from '../projects/types'

export type RegistryEntry = {
  bundleId: string
  name: string
  description: string
  publisherId: string
  hash: string
  publishedAt: string
  latestVersion: string
}

export type RegistryBundle = RegistryEntry & {
  bundle: ProjectBundle
}

export type PublishResult = {
  bundleId: string
  hash: string
  latestVersion: string
}

export function listRegistry(): Promise<RegistryEntry[]> {
  return apiFetch<RegistryEntry[]>(`${SERVER_BASE}/registry`)
}

export function searchRegistry(q: string): Promise<RegistryEntry[]> {
  const params = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''
  return apiFetch<RegistryEntry[]>(`${SERVER_BASE}/registry/search${params}`)
}

export function getRegistryBundle(bundleId: string): Promise<RegistryBundle> {
  return apiFetch<RegistryBundle>(`${SERVER_BASE}/registry/${encodeURIComponent(bundleId)}`)
}

export function publishBundle(bundle: ProjectBundle): Promise<PublishResult> {
  return apiFetch<PublishResult>(`${SERVER_BASE}/registry/publish`, {
    method: 'POST',
    body: JSON.stringify(bundle),
  })
}

export function verifyRegistryBundle(bundleId: string, hash: string): Promise<{ valid: boolean }> {
  return apiFetch<{ valid: boolean }>(
    `${SERVER_BASE}/registry/${encodeURIComponent(bundleId)}/verify?hash=${encodeURIComponent(hash)}`
  )
}
