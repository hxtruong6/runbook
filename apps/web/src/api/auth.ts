const BASE = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:3001'

type AuthResponse = { token: string }
type OkResponse = { ok: boolean }

async function authPost<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({})) as { error?: string }
    throw new Error(data.error ?? 'Request failed')
  }
  return res.json() as Promise<T>
}

export function postLogin(email: string, password: string) {
  return authPost<AuthResponse>(`${BASE}/auth/login`, { email, password })
}

export function postRegister(email: string, name: string, password: string) {
  return authPost<AuthResponse>(`${BASE}/auth/register`, { email, name, password })
}

export function postForgotPassword(email: string) {
  return authPost<OkResponse>(`${BASE}/auth/forgot-password`, { email })
}

export function postResetPassword(token: string, password: string) {
  return authPost<OkResponse>(`${BASE}/auth/reset-password`, { token, password })
}
