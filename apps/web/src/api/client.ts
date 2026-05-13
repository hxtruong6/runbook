export class ApiError extends Error {
  details?: string[]
  constructor(public status: number, message: string, details?: string[]) {
    super(message)
    this.details = details
  }
}

const BASE = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:3001'

export const SERVER_BASE = BASE

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { useAuthStore } = await import('../auth/authStore')
  const token = useAuthStore.getState().token

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (init.headers) Object.assign(headers, init.headers)
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(path, { ...init, headers })

  if (res.status === 401) {
    useAuthStore.getState().logout()
    throw new ApiError(401, 'Session expired')
  }

  if (!res.ok) {
    let message = res.statusText
    let details: string[] | undefined
    try {
      const body = await res.json() as { error?: string; message?: string; details?: string[] }
      message = body.error ?? body.message ?? message
      details = body.details
    } catch { /* ignore */ }
    throw new ApiError(res.status, message, details)
  }

  return res.json() as Promise<T>
}
