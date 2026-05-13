import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { postLogin, postRegister } from '../api/auth'

type AuthState = {
  token: string | null
  error: string | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  register: (email: string, name: string, password: string) => Promise<void>
  clearError: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      error: null,
      loading: false,
      async login(email, password) {
        set({ loading: true, error: null })
        try {
          const { token } = await postLogin(email, password)
          set({ token, loading: false })
        } catch (e) {
          set({ loading: false, error: (e as Error).message })
        }
      },
      logout() {
        set({ token: null, error: null })
      },
      clearError() {
        set({ error: null })
      },
      async register(email, name, password) {
        set({ loading: true, error: null })
        try {
          const { token } = await postRegister(email, name, password)
          set({ token, loading: false })
        } catch (e) {
          set({ loading: false, error: (e as Error).message })
        }
      },
    }),
    { name: 'runbook:auth', partialize: (s) => ({ token: s.token }) }
  )
)
