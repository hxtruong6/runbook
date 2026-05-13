const BASE = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:3001'

type AuthResponse = { token: string }

async function authPost(url: string, body: unknown): Promise<AuthResponse> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({})) as { error?: string }
    throw new Error(data.error ?? 'Request failed')
  }
  return res.json() as Promise<AuthResponse>
}

export function postLogin(email: string, password: string) {
  return authPost(`${BASE}/auth/login`, { email, password })
}

export function postRegister(email: string, name: string, password: string) {
  return authPost(`${BASE}/auth/register`, { email, name, password })
}
