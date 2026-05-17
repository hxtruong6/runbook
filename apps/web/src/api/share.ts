// apps/web/src/api/share.ts
import { SERVER_BASE, apiFetch } from './client'

export type SharePayload = {
  bundleId?: string
  bundle?: Record<string, unknown>
  scenarioId?: string
  runResult?: unknown
  ttlDays?: number
}

export type ShareCreateResult = {
  slug: string
  url: string
}

export type ShareRecord = {
  slug: string
  payload: {
    bundleId: string | null
    bundle: Record<string, unknown> | null
    scenarioId: string | null
    runResult: unknown
  }
  createdAt: string
  expiresAt: string
}

export async function createShare(input: SharePayload): Promise<ShareCreateResult> {
  return apiFetch<ShareCreateResult>(`${SERVER_BASE}/api/share`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function getShare(slug: string): Promise<ShareRecord> {
  return apiFetch<ShareRecord>(`${SERVER_BASE}/api/share/${slug}`)
}
