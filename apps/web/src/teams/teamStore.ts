import { create } from 'zustand'
import { getTeams, postTeam, type ApiTeam } from '../api/teams'

type TeamState = {
  teams: ApiTeam[]
  activeTeamId: string | null
  needsTeam: boolean
  loading: boolean
  error: string | null
  fetchTeams: () => Promise<void>
  createTeam: (name: string) => Promise<void>
  setActiveTeam: (id: string) => void
  reset: () => void
}

export const useTeamStore = create<TeamState>()((set, get) => ({
  teams: [],
  activeTeamId: null,
  needsTeam: false,
  loading: false,
  error: null,
  async fetchTeams() {
    set({ loading: true, error: null })
    try {
      const teams = await getTeams()
      const current = get().activeTeamId
      const shouldAutoSelect = !current || !teams.find((t) => t._id === current)
      set({
        teams,
        loading: false,
        needsTeam: teams.length === 0,
        activeTeamId: shouldAutoSelect ? (teams[0]?._id ?? null) : current,
      })
    } catch (e) {
      set({ loading: false, error: (e as Error).message })
    }
  },
  async createTeam(name) {
    set({ loading: true, error: null })
    try {
      const team = await postTeam(name)
      set((s) => ({
        teams: [...s.teams, team],
        activeTeamId: team._id,
        needsTeam: false,
        loading: false,
      }))
    } catch (e) {
      set({ loading: false, error: (e as Error).message })
    }
  },
  setActiveTeam(id) {
    set({ activeTeamId: id })
  },
  reset() {
    set({ teams: [], activeTeamId: null, needsTeam: false })
  },
}))
