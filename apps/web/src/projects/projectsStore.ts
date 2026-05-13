import { create } from 'zustand'
import {
  getProjects, deleteProject as apiDeleteProject,
  postImportBundle, type ApiProject,
} from '../api/projects'
import { ApiError } from '../api/client'
import { ProjectBundleSchema } from './types'

type ProjectsState = {
  projects: ApiProject[]
  activeProjectId: string | null
  loading: boolean
  importing: boolean
  error: string | null
  importErrors: string[]
  fetchProjects: (teamId: string) => Promise<void>
  deleteProject: (teamId: string, projectId: string) => Promise<void>
  setActiveProject: (id: string | null) => void
  importBundle: (file: File, teamId: string) => Promise<void>
  reset: () => void
}

export const useProjectsStore = create<ProjectsState>()((set, get) => ({
  projects: [],
  activeProjectId: null,
  loading: false,
  importing: false,
  error: null,
  importErrors: [],

  async fetchProjects(teamId) {
    set({ loading: true, error: null })
    try {
      const projects = await getProjects(teamId)
      set({ projects, loading: false })
    } catch (e) {
      set({ loading: false, error: (e as Error).message })
    }
  },

  async deleteProject(teamId, projectId) {
    await apiDeleteProject(teamId, projectId)
    set((s) => ({
      projects: s.projects.filter((p) => p._id !== projectId),
      activeProjectId: s.activeProjectId === projectId ? null : s.activeProjectId,
    }))
  },

  setActiveProject(id) {
    set({ activeProjectId: id })
  },

  async importBundle(file, teamId) {
    set({ importing: true, error: null, importErrors: [] })
    let bundle
    try {
      const text = await file.text()
      const raw = JSON.parse(text) as unknown
      const result = ProjectBundleSchema.safeParse(raw)
      if (!result.success) {
        const errors = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
        set({ importing: false, importErrors: errors })
        return
      }
      bundle = result.data
    } catch {
      set({ importing: false, error: 'Could not read or parse file' })
      return
    }
    try {
      await postImportBundle(teamId, bundle)
      await get().fetchProjects(teamId)
      set({ importing: false })
    } catch (e) {
      if (e instanceof ApiError) {
        set({ importing: false, importErrors: e.details ?? [e.message] })
      } else {
        set({ importing: false, error: (e as Error).message })
      }
    }
  },

  reset() {
    set({ projects: [], activeProjectId: null, importErrors: [] })
  },
}))
