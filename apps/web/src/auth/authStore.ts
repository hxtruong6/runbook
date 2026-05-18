import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { postLogin, postRegister, postForgotPassword, postResetPassword } from '../api/auth'

type AuthState = {
  token: string | null
  isGuest: boolean
  error: string | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  loginAsGuest: () => void
  logout: () => void
  register: (email: string, name: string, password: string) => Promise<void>
  forgotPassword: (email: string) => Promise<void>
  resetPassword: (token: string, password: string) => Promise<void>
  clearError: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      isGuest: false,
      error: null,
      loading: false,

      async login(email, password) {
        set({ loading: true, error: null })
        try {
          const { token } = await postLogin(email, password)
          set({ token, isGuest: false, loading: false })
        } catch (e) {
          set({ loading: false, error: (e as Error).message })
        }
      },

      loginAsGuest() {
        set({ isGuest: true, token: null, error: null })
      },

      logout() {
        set({ token: null, isGuest: false, error: null })
      },

      async register(email, name, password) {
        set({ loading: true, error: null })
        try {
          const { token } = await postRegister(email, name, password)
          set({ token, isGuest: false, loading: false })
        } catch (e) {
          set({ loading: false, error: (e as Error).message })
        }
      },

      async forgotPassword(email) {
        set({ loading: true, error: null })
        try {
          await postForgotPassword(email)
          set({ loading: false })
        } catch (e) {
          set({ loading: false, error: (e as Error).message })
          throw e
        }
      },

      async resetPassword(token, password) {
        set({ loading: true, error: null })
        try {
          await postResetPassword(token, password)
          set({ loading: false })
        } catch (e) {
          set({ loading: false, error: (e as Error).message })
          throw e
        }
      },

      clearError() {
        set({ error: null })
      },
    }),
    { name: 'runbook:auth', partialize: (s) => ({ token: s.token, isGuest: s.isGuest }) }
  )
)
