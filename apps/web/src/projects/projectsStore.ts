// apps/web/src/projects/projectsStore.ts
import { create } from 'zustand'
import {
  getProjects, deleteProject as apiDeleteProject,
  postImportBundle, postProject, type ApiProject, type ApiProjectVersion,
} from '../api/projects'
import { publishBundle as apiPublishBundle, type PublishResult } from '../api/registry'
import { ApiError } from '../api/client'
import { ProjectBundleSchema, type ProjectBundle, type ProjectVersion } from './types'
import type { Scenario } from '../scenarios/types'

function buildBundleForPublish(project: ApiProject, scenarios: Scenario[]): ProjectBundle {
  const mappedVersions: ProjectVersion[] = (project.versions ?? []).map((v: ApiProjectVersion) => ({
    version: v.version,
    releasedAt: v.releasedAt,
    releaseNotes: v.releaseNotes ?? '',
    changes: (v.changes ?? []) as ProjectVersion['changes'],
    blocks: (v.blocks ?? []) as ProjectVersion['blocks'],
    scenarios,
    environments: (v.environments ?? []) as ProjectVersion['environments'],
    docs: v.docs ?? {},
  }))

  if (mappedVersions.length === 0) {
    mappedVersions.push({
      version: '1.0.0',
      releasedAt: new Date().toISOString(),
      releaseNotes: '',
      changes: [],
      blocks: [],
      scenarios,
      environments: [],
      docs: {},
    })
  }

  return {
    id: project._id,
    name: project.name,
    description: '',
    createdAt: project.createdAt,
    versions: mappedVersions,
  }
}

type ProjectsState = {
  projects: ApiProject[]
  activeProjectId: string | null
  loading: boolean
  importing: boolean
  publishing: boolean
  error: string | null
  importErrors: string[]
  fetchProjects: (teamId: string) => Promise<void>
  createProject: (teamId: string, name: string) => Promise<ApiProject>
  deleteProject: (teamId: string, projectId: string) => Promise<void>
  setActiveProject: (id: string | null) => void
  importBundle: (file: File, teamId: string) => Promise<void>
  importBundleObject: (bundle: ProjectBundle, teamId: string) => Promise<void>
  publishBundle: (teamId: string, scenarios: Scenario[]) => Promise<PublishResult>
  reset: () => void
}

export const useProjectsStore = create<ProjectsState>()((set, get) => ({
  projects: [],
  activeProjectId: null,
  loading: false,
  importing: false,
  publishing: false,
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

  async createProject(teamId, name) {
    const project = await postProject(teamId, name)
    set((s) => ({ projects: [...s.projects, project], activeProjectId: project._id }))
    return project
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
    await get().importBundleObject(bundle, teamId)
  },

  async importBundleObject(bundle, teamId) {
    set({ importing: true, error: null, importErrors: [] })
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

  async publishBundle(_teamId, scenarios) {
    const state = get()
    const project = state.projects.find((p) => p._id === state.activeProjectId)
    if (!project) throw new Error('No active project selected')
    set({ publishing: true, error: null })
    try {
      const bundle = buildBundleForPublish(project, scenarios)
      const result = await apiPublishBundle(bundle)
      set({ publishing: false })
      return result
    } catch (e) {
      set({ publishing: false, error: (e as Error).message })
      throw e
    }
  },

  reset() {
    set({ projects: [], activeProjectId: null, importErrors: [] })
  },
}))
