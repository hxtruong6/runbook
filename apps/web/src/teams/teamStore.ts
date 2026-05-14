import { create } from 'zustand'
import { getTeams, postTeam, getMembers, inviteMember as apiInviteMember, removeMember as apiRemoveMember, type ApiTeam, type ApiMember } from '../api/teams'
import { useAuthStore } from '../auth/authStore'

type TeamState = {
  teams: ApiTeam[]
  activeTeamId: string | null
  needsTeam: boolean
  loading: boolean
  error: string | null
  members: ApiMember[]
  membersLoading: boolean
  membersError: string | null
  currentUserRole: 'owner' | 'admin' | 'member' | null
  fetchTeams: () => Promise<void>
  createTeam: (name: string) => Promise<void>
  setActiveTeam: (id: string) => void
  reset: () => void
  fetchMembers: (teamId: string) => Promise<void>
  inviteMember: (teamId: string, email: string, role: 'admin' | 'member') => Promise<void>
  removeMember: (teamId: string, userId: string) => Promise<void>
}

function getCurrentUserId(): string | null {
  try {
    const token = useAuthStore.getState().token
    if (!token) return null
    const payload = token.split('.')[1]
    const decoded = JSON.parse(atob(payload)) as { sub?: string }
    return decoded.sub ?? null
  } catch {
    return null
  }
}

export const useTeamStore = create<TeamState>()((set, get) => ({
  teams: [],
  activeTeamId: null,
  needsTeam: false,
  loading: false,
  error: null,
  members: [],
  membersLoading: false,
  membersError: null,
  currentUserRole: null,
  async fetchTeams() {
    set({ loading: true, error: null })
    try {
      const teams = await getTeams()
      const current = get().activeTeamId
      const shouldAutoSelect = !current || !teams.find((t) => t._id === current)
      const activeTeamId = shouldAutoSelect ? (teams[0]?._id ?? null) : current
      set({
        teams,
        loading: false,
        needsTeam: teams.length === 0,
        activeTeamId,
      })
      if (activeTeamId) {
        void get().fetchMembers(activeTeamId)
      }
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
  async fetchMembers(teamId) {
    set({ membersLoading: true, membersError: null })
    try {
      const members = await getMembers(teamId)
      const userId = getCurrentUserId()
      const me = members.find((m) => m.userId === userId)
      set({
        members,
        membersLoading: false,
        currentUserRole: me?.role ?? null,
      })
    } catch (e) {
      set({ membersLoading: false, membersError: (e as Error).message })
    }
  },
  async inviteMember(teamId, email, role) {
    await apiInviteMember(teamId, email, role)
    await get().fetchMembers(teamId)
  },
  async removeMember(teamId, userId) {
    await apiRemoveMember(teamId, userId)
    set((s) => ({
      members: s.members.filter((m) => m.userId !== userId),
    }))
  },
}))
