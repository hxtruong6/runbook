# API Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all localStorage-backed project/scenario state with API-backed Zustand stores, gate the app behind JWT auth, and wire bundle import to the server.

**Architecture:** Zustand stores (auth, teams, projects, scenarios) replace Context/useReducer and localStorage. A typed `apiFetch` client injects tokens and normalises errors. A new server endpoint `POST /teams/:teamId/projects/import` accepts a full `ProjectBundle`, validates it with Zod, and persists all entities atomically.

**Tech Stack:** Zustand (new), existing Zod, Mantine, Fastify, MongoDB, Vitest

**Spec:** `docs/superpowers/specs/2026-05-13-api-migration-design.md`

> **Import style note:** Frontend (Vite) imports omit the `.js` extension. Server imports keep `.js`. Follow the convention already in each app.

---

## File Map

### New — frontend
| File | Responsibility |
|------|---------------|
| `apps/web/.env` | `VITE_SERVER_URL` pointing at Fastify |
| `apps/web/src/api/client.ts` | `apiFetch<T>` + `ApiError` |
| `apps/web/src/api/auth.ts` | `postLogin`, `postRegister` (no token needed) |
| `apps/web/src/api/teams.ts` | `getTeams`, `postTeam` |
| `apps/web/src/api/projects.ts` | `getProjects`, `deleteProject`, `postImportBundle` |
| `apps/web/src/api/scenarios.ts` | `getScenarios`, `postScenario`, `patchScenario`, `deleteScenario` |
| `apps/web/src/auth/authStore.ts` | Zustand auth store with `persist` middleware |
| `apps/web/src/auth/LoginPage.tsx` | Login / Register tabs |
| `apps/web/src/teams/teamStore.ts` | Zustand teams store |
| `apps/web/src/teams/CreateTeamModal.tsx` | Modal for first-time team creation |
| `apps/web/src/projects/projectsStore.ts` | Zustand projects store |
| `apps/web/src/scenarios/scenariosStore.ts` | Zustand scenarios store |

### Modified — frontend
| File | Change |
|------|--------|
| `apps/web/package.json` | add `zustand` |
| `apps/web/src/App.tsx` | auth gate; use Zustand stores; remove localStorage |
| `apps/web/src/components/TopBar.tsx` | add team switcher `<Select>` |
| `apps/web/src/components/ProjectSwitcher.tsx` | use `importBundle()` instead of local dispatch |

### Modified — server
| File | Change |
|------|--------|
| `apps/server/src/routes/projects.ts` | add `POST /import` endpoint |
| `apps/server/src/routes/scenarios.ts` | add `?projectId` query filter; extend `CreateScenarioBodySchema` |
| `apps/server/tests/projects.test.ts` | add import endpoint tests |

### Deleted — frontend
- `apps/web/src/projects/ProjectsStore.tsx` (replaced by `projectsStore.ts`)
- `apps/web/src/scenarios/storage.ts` (replaced by `scenariosStore.ts`)

---

## Shared types (referenced across tasks)

```ts
// Used in API modules and stores
type ApiTeam = { _id: string; name: string; slug: string; createdAt: string }
type ApiProject = { _id: string; teamId: string; name: string; createdAt: string }
type ApiScenario = {
  _id: string; projectId: string; teamId: string
  name: string; blocks: BlockInstance[]
  reusable?: boolean; graphData?: GraphData
  updatedAt: string; updatedBy: string
}
type PatchOp = { op: 'replace' | 'add' | 'remove'; path: string; value?: unknown }
```

---

## Task 1: Install zustand and configure server base URL

**Files:**
- Modify: `apps/web/package.json`
- Create: `apps/web/.env`

- [ ] **Step 1: Add zustand**

```bash
cd apps/web && pnpm add zustand
```

Expected output: `+ zustand X.X.X`

- [ ] **Step 2: Create .env**

Create `apps/web/.env`:
```
VITE_SERVER_URL=http://localhost:3001
```

- [ ] **Step 3: Add env type declaration**

Create (or update) `apps/web/src/vite-env.d.ts` — add the custom variable:
```ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SERVER_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
```

After this, all files can use `import.meta.env.VITE_SERVER_URL` without a cast.

- [ ] **Step 4: Commit**

```bash
git add apps/web/package.json apps/web/pnpm-lock.yaml apps/web/.env apps/web/src/vite-env.d.ts
git commit -m "chore: add zustand, configure server base URL, add env types"
```

---

## Task 2: API client base

**Files:**
- Create: `apps/web/src/api/client.ts`

- [ ] **Step 1: Write the implementation**

Create `apps/web/src/api/client.ts`:
```ts
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
  const { useAuthStore } = await import('../auth/authStore.js')
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
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/api/client.ts
git commit -m "feat: add typed apiFetch client with ApiError"
```

---

## Task 3: Auth API + store

**Files:**
- Create: `apps/web/src/api/auth.ts`
- Create: `apps/web/src/auth/authStore.ts`

- [ ] **Step 1: Create auth API module**

Create `apps/web/src/api/auth.ts`:
```ts
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
```

- [ ] **Step 2: Create auth store**

Create `apps/web/src/auth/authStore.ts`:
```ts
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
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/api/auth.ts apps/web/src/auth/authStore.ts
git commit -m "feat: auth API module and Zustand auth store with JWT persistence"
```

---

## Task 4: Login page + auth gate

**Files:**
- Create: `apps/web/src/auth/LoginPage.tsx`
- Modify: `apps/web/src/App.tsx` (auth gate only — full rewrite comes in Task 12)

- [ ] **Step 1: Create LoginPage**

Create `apps/web/src/auth/LoginPage.tsx`:
```tsx
import { useState } from 'react'
import {
  Alert, Button, Center, Paper, PasswordInput, Stack,
  Tabs, Text, TextInput, Title,
} from '@mantine/core'
import { useAuthStore } from './authStore'

export function LoginPage() {
  const { login, register, loading, error } = useAuthStore()
  const [tab, setTab] = useState<string | null>('login')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (tab === 'login') {
      await login(email, password)
    } else {
      await register(email, name, password)
    }
  }

  return (
    <Center h="100vh">
      <Paper w={380} p="xl">
        <Stack gap="md">
          <Title order={3}>Runbook</Title>
          <Tabs value={tab} onChange={setTab}>
            <Tabs.List>
              <Tabs.Tab value="login">Sign in</Tabs.Tab>
              <Tabs.Tab value="register">Create account</Tabs.Tab>
            </Tabs.List>
          </Tabs>
          <form onSubmit={handleSubmit}>
            <Stack gap="sm">
              {error && <Alert color="red">{error}</Alert>}
              <TextInput
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.currentTarget.value)}
                required
              />
              {tab === 'register' && (
                <TextInput
                  label="Name"
                  value={name}
                  onChange={(e) => setName(e.currentTarget.value)}
                  required
                />
              )}
              <PasswordInput
                label="Password"
                value={password}
                onChange={(e) => setPassword(e.currentTarget.value)}
                required
              />
              <Button type="submit" loading={loading} fullWidth mt="xs">
                {tab === 'login' ? 'Sign in' : 'Create account'}
              </Button>
            </Stack>
          </form>
        </Stack>
      </Paper>
    </Center>
  )
}
```

- [ ] **Step 2: Add auth gate to App.tsx**

In `apps/web/src/App.tsx`, add at the top of the `App` function body (before the return statement):

```tsx
// Add import at top of file:
import { useAuthStore } from './auth/authStore'
import { LoginPage } from './auth/LoginPage'

// Add inside App() before return:
const token = useAuthStore((s) => s.token)
if (!token) return <LoginPage />
```

- [ ] **Step 3: Verify app shows login page**

Run `pnpm dev` in `apps/web`. Open http://localhost:3000. The app should show the login form, not the main shell.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/auth/LoginPage.tsx apps/web/src/App.tsx
git commit -m "feat: login/register page with auth gate"
```

---

## Task 5: Teams API + store + CreateTeamModal

**Files:**
- Create: `apps/web/src/api/teams.ts`
- Create: `apps/web/src/teams/teamStore.ts`
- Create: `apps/web/src/teams/CreateTeamModal.tsx`

- [ ] **Step 1: Create teams API module**

Create `apps/web/src/api/teams.ts`:
```ts
import { apiFetch, SERVER_BASE } from './client'

export type ApiTeam = { _id: string; name: string; slug: string; createdAt: string }

export function getTeams(): Promise<ApiTeam[]> {
  return apiFetch<ApiTeam[]>(`${SERVER_BASE}/teams`)
}

export function postTeam(name: string): Promise<ApiTeam> {
  return apiFetch<ApiTeam>(`${SERVER_BASE}/teams`, {
    method: 'POST',
    body: JSON.stringify({ name }),
  })
}
```

- [ ] **Step 2: Create team store**

Create `apps/web/src/teams/teamStore.ts`:
```ts
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

export const useTeamStore = create<TeamState>()((set) => ({
  teams: [],
  activeTeamId: null,
  needsTeam: false,
  loading: false,
  error: null,
  async fetchTeams() {
    set({ loading: true, error: null })
    try {
      const teams = await getTeams()
      set({
        teams,
        loading: false,
        needsTeam: teams.length === 0,
        activeTeamId: teams[0]?._id ?? null,
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
```

- [ ] **Step 3: Create CreateTeamModal**

Create `apps/web/src/teams/CreateTeamModal.tsx`:
```tsx
import { useState } from 'react'
import { Alert, Button, Modal, Stack, Text, TextInput } from '@mantine/core'
import { useTeamStore } from './teamStore'

export function CreateTeamModal() {
  const { needsTeam, createTeam, loading, error } = useTeamStore()
  const [name, setName] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (name.trim()) await createTeam(name.trim())
  }

  return (
    <Modal opened={needsTeam} onClose={() => {}} title="Create your first team" withCloseButton={false}>
      <form onSubmit={handleSubmit}>
        <Stack gap="sm">
          <Text size="sm" c="dimmed">
            Teams group your projects and scenarios. You can invite colleagues later.
          </Text>
          {error && <Alert color="red">{error}</Alert>}
          <TextInput
            label="Team name"
            placeholder="e.g. 32CO"
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
            required
            data-autofocus
          />
          <Button type="submit" loading={loading} fullWidth>
            Create team
          </Button>
        </Stack>
      </form>
    </Modal>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/api/teams.ts apps/web/src/teams/teamStore.ts apps/web/src/teams/CreateTeamModal.tsx
git commit -m "feat: teams API module, Zustand team store, CreateTeamModal"
```

---

## Task 6: Wire team loading into App.tsx

**Files:**
- Modify: `apps/web/src/App.tsx`

- [ ] **Step 1: Add team bootstrap after auth**

In `apps/web/src/App.tsx`, add imports and bootstrap logic:

```tsx
// Add imports:
import { useTeamStore } from './teams/teamStore'
import { CreateTeamModal } from './teams/CreateTeamModal'

// Inside App(), after the token guard:
const { teams, activeTeamId, fetchTeams, setActiveTeam, needsTeam } = useTeamStore()

useEffect(() => {
  if (token) fetchTeams()
}, [token])
```

- [ ] **Step 2: Render CreateTeamModal**

Add `<CreateTeamModal />` at the bottom of the App return, just before closing `</RegistryProvider>`:

```tsx
<CreateTeamModal />
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/App.tsx
git commit -m "feat: fetch teams on login, show CreateTeamModal when no team exists"
```

---

## Task 7: Projects API + store

**Files:**
- Create: `apps/web/src/api/projects.ts`
- Create: `apps/web/src/projects/projectsStore.ts`

- [ ] **Step 1: Create projects API module**

Create `apps/web/src/api/projects.ts`:
```ts
import { apiFetch, SERVER_BASE, ApiError } from './client'
import type { ProjectBundle } from '../projects/types'

export type ApiProject = { _id: string; teamId: string; name: string; createdAt: string }
export type ImportResult = { project: ApiProject; scenarios: unknown[] }

export function getProjects(teamId: string): Promise<ApiProject[]> {
  return apiFetch<ApiProject[]>(`${SERVER_BASE}/teams/${teamId}/projects`)
}

export function deleteProject(teamId: string, projectId: string): Promise<void> {
  return apiFetch<void>(`${SERVER_BASE}/teams/${teamId}/projects/${projectId}`, { method: 'DELETE' })
}

export async function postImportBundle(teamId: string, bundle: ProjectBundle): Promise<ImportResult> {
  return apiFetch<ImportResult>(`${SERVER_BASE}/teams/${teamId}/projects/import`, {
    method: 'POST',
    body: JSON.stringify(bundle),
  })
}

export { ApiError }
```

- [ ] **Step 2: Create projects store**

Create `apps/web/src/projects/projectsStore.ts`:
```ts
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
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/api/projects.ts apps/web/src/projects/projectsStore.ts
git commit -m "feat: projects API module and Zustand projects store with importBundle"
```

---

## Task 8: Scenarios API + store + server schema update

**Files:**
- Modify: `apps/server/src/routes/scenarios.ts`
- Create: `apps/web/src/api/scenarios.ts`
- Create: `apps/web/src/scenarios/scenariosStore.ts`

- [ ] **Step 1: Extend server CreateScenarioBodySchema and add projectId filter**

In `apps/server/src/routes/scenarios.ts`, update the schema and GET handler:

```ts
// Replace the existing CreateScenarioBodySchema with:
const CreateScenarioBodySchema = z.object({
  name: z.string().min(1),
  projectId: z.string(),
  blocks: z.array(z.unknown()).default([]),
  reusable: z.boolean().optional(),
  graphData: z.unknown().optional(),
})

// Replace the GET /:teamId/scenarios handler body with:
app.get('/:teamId/scenarios', { preHandler: [authenticate] }, async (req, reply) => {
  const { teamId } = req.params as { teamId: string }
  const { projectId } = req.query as { projectId?: string }
  const user = req.user as { sub: string }
  const db = getDb()
  if (!(await assertMember(db, user.sub, teamId))) return reply.code(403).send({ error: 'Forbidden' })
  const filter: Record<string, unknown> = { teamId }
  if (projectId) filter['projectId'] = projectId
  const scenarios = await db.collection('scenarios').find(filter).toArray()
  return reply.send(scenarios)
})

// Update the POST /:teamId/scenarios handler to include reusable/graphData:
const result = await db.collection('scenarios').insertOne({
  teamId,
  projectId: body.data.projectId,
  name: body.data.name,
  blocks: body.data.blocks,
  reusable: body.data.reusable ?? false,
  graphData: body.data.graphData,
  updatedAt: new Date(),
  updatedBy: user.sub,
})
```

- [ ] **Step 2: Create scenarios API module**

Create `apps/web/src/api/scenarios.ts`:
```ts
import { apiFetch, SERVER_BASE } from './client'
import type { BlockInstance } from '../scenarios/types'
import type { GraphData } from '../graph/types'

export type ApiScenario = {
  _id: string
  projectId: string
  teamId: string
  name: string
  blocks: BlockInstance[]
  reusable?: boolean
  graphData?: GraphData
  updatedAt: string
  updatedBy: string
}

type PatchOp = { op: 'replace' | 'add' | 'remove'; path: string; value?: unknown }

export function getScenarios(teamId: string, projectId: string): Promise<ApiScenario[]> {
  return apiFetch<ApiScenario[]>(`${SERVER_BASE}/teams/${teamId}/scenarios?projectId=${projectId}`)
}

export function postScenario(
  teamId: string,
  data: { projectId: string; name: string; blocks?: BlockInstance[]; reusable?: boolean; graphData?: GraphData }
): Promise<ApiScenario> {
  return apiFetch<ApiScenario>(`${SERVER_BASE}/teams/${teamId}/scenarios`, {
    method: 'POST',
    body: JSON.stringify({ ...data, blocks: data.blocks ?? [] }),
  })
}

export function patchScenario(
  teamId: string,
  scenarioId: string,
  fields: { name?: string; blocks?: BlockInstance[]; reusable?: boolean; graphData?: GraphData | null }
): Promise<ApiScenario> {
  const ops: PatchOp[] = []
  if (fields.name !== undefined) ops.push({ op: 'replace', path: '/name', value: fields.name })
  if (fields.blocks !== undefined) ops.push({ op: 'replace', path: '/blocks', value: fields.blocks })
  if (fields.reusable !== undefined) ops.push({ op: 'replace', path: '/reusable', value: fields.reusable })
  if (fields.graphData !== undefined) ops.push({ op: 'replace', path: '/graphData', value: fields.graphData })
  return apiFetch<ApiScenario>(`${SERVER_BASE}/teams/${teamId}/scenarios/${scenarioId}`, {
    method: 'PATCH',
    body: JSON.stringify(ops),
  })
}

export function deleteScenario(teamId: string, scenarioId: string): Promise<void> {
  return apiFetch<void>(`${SERVER_BASE}/teams/${teamId}/scenarios/${scenarioId}`, { method: 'DELETE' })
}
```

- [ ] **Step 3: Create scenarios store**

Create `apps/web/src/scenarios/scenariosStore.ts`:
```ts
import { create } from 'zustand'
import {
  getScenarios, postScenario, patchScenario,
  deleteScenario as apiDelete, type ApiScenario,
} from '../api/scenarios'
import type { Scenario } from './types'
import type { BlockInstance } from './types'
import type { GraphData } from '../graph/types'

export function toScenario(a: ApiScenario): Scenario {
  return {
    id: a._id,
    name: a.name,
    createdAt: a.updatedAt,
    blocks: a.blocks,
    reusable: a.reusable ?? false,
    graphData: a.graphData,
  }
}

type ScenariosState = {
  scenarios: Scenario[]
  loading: boolean
  error: string | null
  fetchScenarios: (teamId: string, projectId: string) => Promise<void>
  createScenario: (teamId: string, projectId: string, name: string) => Promise<Scenario>
  updateScenario: (teamId: string, scenario: Scenario) => void
  deleteScenario: (teamId: string, scenarioId: string) => Promise<void>
  reset: () => void
}

export const useScenariosStore = create<ScenariosState>()((set, get) => ({
  scenarios: [],
  loading: false,
  error: null,

  async fetchScenarios(teamId, projectId) {
    set({ loading: true, error: null })
    try {
      const raw = await getScenarios(teamId, projectId)
      set({ scenarios: raw.map(toScenario), loading: false })
    } catch (e) {
      set({ loading: false, error: (e as Error).message })
    }
  },

  async createScenario(teamId, projectId, name) {
    const raw = await postScenario(teamId, { projectId, name })
    const scenario = toScenario(raw)
    set((s) => ({ scenarios: [...s.scenarios, scenario] }))
    return scenario
  },

  updateScenario(teamId, scenario) {
    // Optimistic: update state immediately, sync in background
    set((s) => ({
      scenarios: s.scenarios.map((sc) => sc.id === scenario.id ? scenario : sc),
    }))
    patchScenario(teamId, scenario.id, {
      name: scenario.name,
      blocks: scenario.blocks as BlockInstance[],
      reusable: scenario.reusable,
      graphData: scenario.graphData as GraphData | undefined,
    }).catch(console.error)
  },

  async deleteScenario(teamId, scenarioId) {
    await apiDelete(teamId, scenarioId)
    set((s) => ({ scenarios: s.scenarios.filter((sc) => sc.id !== scenarioId) }))
  },

  reset() {
    set({ scenarios: [], error: null })
  },
}))
```

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/routes/scenarios.ts \
        apps/web/src/api/scenarios.ts \
        apps/web/src/scenarios/scenariosStore.ts
git commit -m "feat: scenarios API module, Zustand scenarios store, server projectId filter"
```

---

## Task 9: Server import endpoint + tests

**Files:**
- Modify: `apps/server/src/routes/projects.ts`
- Modify: `apps/server/tests/projects.test.ts`

- [ ] **Step 1: Write the failing test first**

Append to `apps/server/tests/projects.test.ts`:

```ts
it('POST /teams/:teamId/projects/import creates project and scenarios from bundle', async () => {
  const app = buildApp()
  await app.ready()
  const { token, teamId } = await setupTeam(app, 'import-test-1@example.com')

  const bundle = {
    id: 'bundle-1',
    name: 'My Bundle',
    createdAt: '2026-01-01T00:00:00Z',
    versions: [
      {
        version: '1.0.0',
        releasedAt: '2026-01-01T00:00:00Z',
        releaseNotes: '',
        changes: [],
        blocks: [],
        environments: [],
        docs: {},
        scenarios: [
          {
            id: 'sc-1',
            name: 'Happy path',
            createdAt: '2026-01-01T00:00:00Z',
            blocks: [{ id: 'b1', kind: 'signin', overrides: {} }],
            reusable: false,
          },
        ],
      },
    ],
  }

  const res = await app.inject({
    method: 'POST',
    url: `/teams/${teamId}/projects/import`,
    headers: { authorization: `Bearer ${token}` },
    payload: bundle,
  })

  expect(res.statusCode).toBe(201)
  const body = JSON.parse(res.body) as { project: { name: string }; scenarios: unknown[] }
  expect(body.project.name).toBe('My Bundle')
  expect(body.scenarios.length).toBe(1)
  await app.close()
})

it('POST /teams/:teamId/projects/import returns 400 on invalid bundle', async () => {
  const app = buildApp()
  await app.ready()
  const { token, teamId } = await setupTeam(app, 'import-test-2@example.com')

  const res = await app.inject({
    method: 'POST',
    url: `/teams/${teamId}/projects/import`,
    headers: { authorization: `Bearer ${token}` },
    payload: { name: 123, versions: 'bad' }, // invalid
  })

  expect(res.statusCode).toBe(400)
  const body = JSON.parse(res.body) as { error: string; details: string[] }
  expect(body.error).toBe('Invalid bundle')
  expect(Array.isArray(body.details)).toBe(true)
  expect(body.details.length).toBeGreaterThan(0)
  await app.close()
})
```

- [ ] **Step 2: Run tests to see them fail**

```bash
cd apps/server && pnpm test
```

Expected: 2 new tests FAIL with `404` (endpoint doesn't exist yet).

- [ ] **Step 3: Implement the import endpoint**

In `apps/server/src/routes/projects.ts`, add these imports and the endpoint before the closing `}` of `projectsRoutes`:

```ts
// Add imports at top of file:
import { z } from 'zod'

// Add these schemas inside projectsRoutes (before the closing brace):
const BlockInstanceImportSchema = z.object({
  id: z.string(),
  kind: z.string(),
  overrides: z.record(z.string(), z.unknown()),
})

const ScenarioImportSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  blocks: z.array(BlockInstanceImportSchema),
  reusable: z.boolean().optional(),
  graphData: z.unknown().optional(),
})

const VersionImportSchema = z.object({
  version: z.string(),
  releasedAt: z.string(),
  releaseNotes: z.string().optional().default(''),
  changes: z.array(z.unknown()).default([]),
  blocks: z.array(z.unknown()).default([]),
  environments: z.array(z.unknown()).default([]),
  docs: z.record(z.string(), z.string()).optional().default({}),
  scenarios: z.array(ScenarioImportSchema),
})

const ImportBundleSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  createdAt: z.string().optional(),
  versions: z.array(VersionImportSchema),
})

// Add the endpoint:
app.post('/:teamId/projects/import', { preHandler: [authenticate] }, async (req, reply) => {
  const { teamId } = req.params as { teamId: string }
  const user = req.user as { sub: string }
  const db = getDb()

  if (!(await assertMember(db, user.sub, teamId))) return reply.code(403).send({ error: 'Forbidden' })

  const parsed = ImportBundleSchema.safeParse(req.body)
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
    return reply.code(400).send({ error: 'Invalid bundle', details })
  }

  const bundle = parsed.data

  const projectResult = await db.collection('projects').insertOne({
    teamId,
    name: bundle.name,
    description: bundle.description ?? '',
    createdAt: new Date(),
  })

  const projectId = projectResult.insertedId.toString()

  const scenarioDocs = bundle.versions.flatMap((v) =>
    v.scenarios.map((s) => ({
      teamId,
      projectId,
      name: s.name,
      blocks: s.blocks,
      reusable: s.reusable ?? false,
      graphData: s.graphData ?? null,
      updatedAt: new Date(),
      updatedBy: user.sub,
    }))
  )

  let insertedScenarios: unknown[] = []
  if (scenarioDocs.length > 0) {
    const scenarioResult = await db.collection('scenarios').insertMany(scenarioDocs)
    insertedScenarios = Object.values(scenarioResult.insertedIds).map((id, i) => ({
      ...scenarioDocs[i],
      _id: id,
    }))
  }

  const project = await db.collection('projects').findOne({ _id: projectResult.insertedId })

  return reply.code(201).send({ project, scenarios: insertedScenarios })
})
```

- [ ] **Step 4: Run tests to see them pass**

```bash
cd apps/server && pnpm test
```

Expected: all tests PASS including the 2 new ones.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/routes/projects.ts apps/server/tests/projects.test.ts
git commit -m "feat: POST /teams/:teamId/projects/import endpoint with Zod validation"
```

---

## Task 10: Frontend importBundle + ProjectSwitcher update

**Files:**
- Modify: `apps/web/src/components/ProjectSwitcher.tsx`

- [ ] **Step 1: Rewrite ProjectSwitcher**

Replace the entire content of `apps/web/src/components/ProjectSwitcher.tsx`:

```tsx
import { useRef } from 'react'
import { Alert, Button, Group, Select, Skeleton, Stack, Text } from '@mantine/core'
import { openConfirmModal } from '@mantine/modals'
import { notifications } from '@mantine/notifications'
import { useProjectsStore } from '../projects/projectsStore'
import { useTeamStore } from '../teams/teamStore'

export function ProjectSwitcher() {
  const { projects, activeProjectId, setActiveProject, deleteProject, importBundle, loading, importing, importErrors, error } =
    useProjectsStore()
  const { activeTeamId } = useTeamStore()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const options = projects.map((p) => ({ value: p._id, label: p.name }))

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !activeTeamId) return
    await importBundle(file, activeTeamId)
    if (useProjectsStore.getState().importErrors.length === 0 && !useProjectsStore.getState().error) {
      notifications.show({ color: 'green', message: 'Bundle imported' })
    }
    e.target.value = ''
  }

  function handleDelete() {
    const project = projects.find((p) => p._id === activeProjectId)
    if (!project || !activeTeamId) return
    openConfirmModal({
      title: 'Delete project',
      children: <Text size="sm">Delete &ldquo;{project.name}&rdquo; and all its scenarios?</Text>,
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: () => deleteProject(activeTeamId, project._id),
    })
  }

  return (
    <Stack gap={6}>
      <Text size="xs" tt="uppercase" c="dimmed" fw={600}>Project</Text>

      {loading ? (
        <Skeleton height={32} />
      ) : (
        <Select
          size="xs"
          data={options}
          value={activeProjectId}
          onChange={(val) => setActiveProject(val)}
          placeholder={options.length === 0 ? 'No projects — import one' : 'Select project'}
          disabled={options.length === 0}
          comboboxProps={{ withinPortal: true }}
          styles={{ input: { fontWeight: 500 } }}
        />
      )}

      {error && <Alert color="red" size="xs">{error}</Alert>}
      {importErrors.length > 0 && (
        <Alert color="red" size="xs" title="Import errors">
          {importErrors.map((e, i) => <Text key={i} size="xs">{e}</Text>)}
        </Alert>
      )}

      <Group gap="xs">
        <Button size="xs" variant="default" loading={importing} onClick={() => fileInputRef.current?.click()}>
          Import bundle
        </Button>
        <Button size="xs" variant="subtle" color="red" disabled={!activeProjectId} onClick={handleDelete}>
          Delete
        </Button>
      </Group>

      <input ref={fileInputRef} type="file" accept="application/json" hidden onChange={handleImport} />
    </Stack>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/ProjectSwitcher.tsx
git commit -m "feat: ProjectSwitcher uses importBundle API instead of localStorage"
```

---

## Task 11: Update TopBar with team switcher

**Files:**
- Modify: `apps/web/src/components/TopBar.tsx`

- [ ] **Step 1: Replace TopBar**

Replace the entire content of `apps/web/src/components/TopBar.tsx`:

```tsx
import { useRef, useState } from 'react'
import type { Scenario } from '../scenarios/types'
import { downloadScenario, readScenarioFile } from '../scenarios/exportImport'
import { EnvSwitcher } from './EnvSwitcher'
import { EnvEditorModal } from './EnvEditorModal'
import { Logo } from './Logo'
import { ActionIcon, Badge, Button, Divider, Group, Menu, Select, Title } from '@mantine/core'
import { useTeamStore } from '../teams/teamStore'
import { useProjectsStore } from '../projects/projectsStore'

const ZapIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
  </svg>
)

type Props = {
  active: Scenario | null
  onRunAll: () => void
  onImport: (s: Scenario) => void
  onDuplicate?: (s: Scenario) => void
  onToggleReusable?: () => void
  onBurst?: () => void
}

export function TopBar({ active, onRunAll, onImport, onDuplicate, onToggleReusable, onBurst }: Props) {
  const [editorOpen, setEditorOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { teams, activeTeamId, setActiveTeam } = useTeamStore()
  const { activeProjectId } = useProjectsStore()

  async function handleScenarioImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const s = await readScenarioFile(file)
      onImport({ ...s, id: crypto.randomUUID(), createdAt: new Date().toISOString() })
    } catch (err) {
      alert('Invalid scenario file: ' + (err as Error).message)
    }
    e.target.value = ''
  }

  return (
    <>
      <Group justify="space-between" h="100%" px="md">
        <Group gap="sm" align="center" wrap="nowrap">
          <Logo size={26} />
          <Divider orientation="vertical" />
          {teams.length > 1 && (
            <Select
              size="xs"
              data={teams.map((t) => ({ value: t._id, label: t.name }))}
              value={activeTeamId}
              onChange={(v) => v && setActiveTeam(v)}
              w={140}
              comboboxProps={{ withinPortal: true }}
            />
          )}
          <EnvSwitcher onOpenEditor={() => setEditorOpen(true)} />
        </Group>

        <Group gap="xs" align="center">
          <Title order={5}>{active?.name ?? 'No scenario'}</Title>
          {active?.reusable === true && (
            <Badge size="xs" variant="light" color="violet">ref</Badge>
          )}
        </Group>

        <Group gap="xs">
          <Button variant="filled" disabled={!active} onClick={onRunAll} size="sm">
            Run all
          </Button>
          <Menu position="bottom-end" withinPortal>
            <Menu.Target>
              <ActionIcon variant="subtle" size="lg" aria-label="More actions">⋮</ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item leftSection={<ZapIcon />} disabled={!active} onClick={onBurst}>Burst…</Menu.Item>
              <Menu.Item onClick={() => fileInputRef.current?.click()}>Import scenario</Menu.Item>
              <Menu.Item onClick={() => active && downloadScenario(active)} disabled={!active}>Export scenario</Menu.Item>
              <Menu.Item
                onClick={() => active && onDuplicate?.({ ...active, id: crypto.randomUUID(), name: active.name + ' (copy)', createdAt: new Date().toISOString() })}
                disabled={!active}
              >
                Duplicate scenario
              </Menu.Item>
              <Menu.Item onClick={onToggleReusable} disabled={!active}>
                {active?.reusable ? 'Mark as flow' : 'Mark as reusable'}
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
          <input ref={fileInputRef} type="file" accept="application/json" hidden onChange={handleScenarioImport} />
        </Group>
      </Group>
      <EnvEditorModal opened={editorOpen} onClose={() => setEditorOpen(false)} />
    </>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/TopBar.tsx
git commit -m "feat: TopBar shows team switcher for multi-team users"
```

---

## Task 12: Full App.tsx migration + delete old files

**Files:**
- Modify: `apps/web/src/App.tsx`
- Delete: `apps/web/src/projects/ProjectsStore.tsx`
- Delete: `apps/web/src/scenarios/storage.ts`

- [ ] **Step 1: Replace App.tsx**

Replace the entire content of `apps/web/src/App.tsx`:

```tsx
import { useEffect, useMemo, useState } from 'react'
import { BurstDrawer } from './components/BurstDrawer'
import { makeInitialContext } from './context/ContextStore'
import type { Scenario } from './scenarios/types'
import { AddBlockMenu } from './components/AddBlockMenu'
import { BlockCard } from './components/BlockCard'
import { ContextPanel } from './components/ContextPanel'
import { TopBar } from './components/TopBar'
import { ProjectSwitcher } from './components/ProjectSwitcher'
import { WhatsNewPanel } from './components/WhatsNewPanel'
import { BlockDefsPanel } from './components/BlockDefsPanel'
import { SchemaDocsPanel } from './components/SchemaDocsPanel'
import { useRuntimeContext } from './context/ContextStore'
import { useEnvironments } from './environments/EnvironmentsStore'
import { runScenarioFrom } from './execution/runScenario'
import { buildRegistry } from './blocks/index'
import { getBaseUrl } from './api/config'
import { RegistryProvider } from './blocks/RegistryContext'
import { loadLocalBlocks, upsertLocalBlock, deleteLocalBlock } from './blocks/localBlocksStore'
import type { BlockDefData } from './blocks/dataBlock'
import { useAuthStore } from './auth/authStore'
import { LoginPage } from './auth/LoginPage'
import { useTeamStore } from './teams/teamStore'
import { CreateTeamModal } from './teams/CreateTeamModal'
import { useProjectsStore } from './projects/projectsStore'
import { useScenariosStore } from './scenarios/scenariosStore'
import {
  ActionIcon,
  Alert,
  AppShell,
  Badge,
  Button,
  Divider,
  Group,
  Menu,
  NavLink,
  SegmentedControl,
  ScrollArea,
  Skeleton,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
} from '@mantine/core'
import { modals, openConfirmModal } from '@mantine/modals'
import { IconPlus, IconClipboardList, IconDots } from '@tabler/icons-react'
import { GraphCanvas } from './components/GraphCanvas'
import { runGraph } from './graph/runner'
import type { GraphData } from './graph/types'

export function App() {
  const token = useAuthStore((s) => s.token)
  const { teams, activeTeamId, fetchTeams, setActiveTeam } = useTeamStore()
  const { projects, activeProjectId, setActiveProject, fetchProjects } = useProjectsStore()
  const { scenarios, loading: scenariosLoading, error: scenariosError, fetchScenarios, createScenario, updateScenario, deleteScenario } = useScenariosStore()

  const [activeId, setActiveId] = useState<string | null>(null)
  const { context, dispatch } = useRuntimeContext()
  const { activeEnv } = useEnvironments()
  const [localBlocks, setLocalBlocks] = useState<BlockDefData[]>(() => loadLocalBlocks())
  const [view, setView] = useState<'blocks' | 'whatsnew' | 'apis' | 'schema'>('blocks')
  const [insertAfterIdx, setInsertAfterIdx] = useState<number | null>(null)
  const [burstOpen, setBurstOpen] = useState(false)
  const [graphMode, setGraphMode] = useState<Record<string, 'list' | 'graph'>>({})

  // Bootstrap: fetch teams after login
  useEffect(() => {
    if (token) fetchTeams()
  }, [token])

  // Fetch projects when active team changes
  useEffect(() => {
    if (activeTeamId) fetchProjects(activeTeamId)
  }, [activeTeamId])

  // Fetch scenarios when active project changes
  useEffect(() => {
    if (activeTeamId && activeProjectId) {
      fetchScenarios(activeTeamId, activeProjectId)
      setActiveId(null)
    } else {
      useScenariosStore.getState().reset()
    }
  }, [activeTeamId, activeProjectId])

  // Auto-select first scenario when list loads
  useEffect(() => {
    if (scenarios.length > 0 && !activeId) {
      setActiveId(scenarios[0]!.id)
    }
  }, [scenarios])

  // Reset view when active project changes
  useEffect(() => {
    setView('blocks')
  }, [activeProjectId])

  const registry = useMemo(
    () => buildRegistry(localBlocks, getBaseUrl),
    [localBlocks]
  )

  const burstDeps = useMemo(() => ({
    scenarioLookup: (id: string) => scenarios.find((s) => s.id === id) ?? null,
    registry,
    env: activeEnv ?? null,
    makeCtx: makeInitialContext,
  }), [scenarios, registry, activeEnv])

  const active = scenarios.find((s) => s.id === activeId) ?? null
  const activeMode = active ? (graphMode[active.id] ?? (active.graphData ? 'graph' : 'list')) : 'list'

  if (!token) return <LoginPage />

  function updateActive(next: Scenario) {
    if (!activeTeamId) return
    updateScenario(activeTeamId, next)
  }

  async function runFrom(startIdx: number) {
    if (!active) return
    if (activeMode === 'graph' && active.graphData) {
      await runGraph(
        active.graphData,
        context,
        (newCtx) => { dispatch({ type: 'MERGE', values: newCtx }) },
        activeEnv,
        registry,
        (id) => scenarios.find((s) => s.id === id) ?? null,
      )
    } else {
      await runScenarioFrom(active.blocks, startIdx, context, (newCtx) => {
        dispatch({ type: 'MERGE', values: newCtx })
      }, activeEnv, registry)
    }
  }

  async function importScenario(s: Scenario) {
    if (!activeTeamId || !activeProjectId) return
    const created = await createScenario(activeTeamId, activeProjectId, s.name)
    // then update with full blocks/reusable/graphData
    updateScenario(activeTeamId, { ...created, blocks: s.blocks, reusable: s.reusable ?? false, graphData: s.graphData })
    setActiveId(created.id)
  }

  function openRenameModal(scenario: Scenario) {
    let newName = scenario.name
    modals.open({
      title: 'Rename scenario',
      children: (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            const trimmed = newName.trim()
            if (trimmed && activeTeamId) {
              updateScenario(activeTeamId, { ...scenario, name: trimmed })
            }
            modals.closeAll()
          }}
        >
          <TextInput
            defaultValue={scenario.name}
            onChange={(e) => { newName = e.currentTarget.value }}
            data-autofocus
            mb="sm"
          />
          <Button type="submit" size="sm" fullWidth>Save</Button>
        </form>
      ),
    })
  }

  function openDeleteModal(scenario: Scenario) {
    openConfirmModal({
      title: 'Delete scenario',
      children: <Text size="sm">Delete &ldquo;{scenario.name}&rdquo;? This cannot be undone.</Text>,
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: () => {
        if (!activeTeamId) return
        deleteScenario(activeTeamId, scenario.id)
        if (activeId === scenario.id) {
          setActiveId(scenarios.find((s) => s.id !== scenario.id)?.id ?? null)
        }
      },
    })
  }

  function enableGraphMode(scenario: Scenario) {
    if (scenario.graphData) {
      setGraphMode((m) => ({ ...m, [scenario.id]: 'graph' }))
      return
    }
    const startId = crypto.randomUUID()
    const initialGraphData: GraphData = {
      startNodeId: startId,
      nodes: scenario.blocks.map((b, i) => ({
        blockInstance: b,
        name: b.kind,
        position: { x: 200, y: 80 + i * 120 },
      })).concat([{
        blockInstance: { id: startId, kind: 'start', overrides: {} },
        name: 'Start',
        position: { x: 200, y: 0 },
      }]),
      edges: [],
    }
    updateActive({ ...scenario, graphData: initialGraphData })
    setGraphMode((m) => ({ ...m, [scenario.id]: 'graph' }))
  }

  const activeProject = projects.find((p) => p._id === activeProjectId) ?? null

  return (
    <RegistryProvider registry={registry}>
      <AppShell
        navbar={{ width: 240, breakpoint: 'sm' }}
        aside={{ width: 320, breakpoint: 'md' }}
        header={{ height: 60 }}
        padding="md"
      >
        <AppShell.Header>
          <TopBar
            active={active}
            onRunAll={() => runFrom(0)}
            onImport={importScenario}
            onBurst={() => setBurstOpen(true)}
            onDuplicate={async (s) => {
              if (!activeTeamId || !activeProjectId) return
              const created = await createScenario(activeTeamId, activeProjectId, s.name + ' (copy)')
              updateScenario(activeTeamId, { ...created, blocks: s.blocks, reusable: s.reusable ?? false })
              setActiveId(created.id)
            }}
            onToggleReusable={() => {
              if (!active) return
              updateActive({ ...active, reusable: !active.reusable })
            }}
          />
        </AppShell.Header>

        <AppShell.Navbar p="md" style={{ display: 'flex', flexDirection: 'column' }}>
          <Stack gap="xs" style={{ flexShrink: 0 }}>
            <ProjectSwitcher />
            <Divider my="sm" />

            {activeProject ? (
              <Text size="xs" c="dimmed">{activeProject.name}</Text>
            ) : (
              <Text size="xs" c="dimmed">No project selected</Text>
            )}

            <Group justify="space-between" mt="xs">
              <Text size="xs" tt="uppercase" c="dimmed" fw={600}>Scenarios</Text>
              <Text size="xs" c="dimmed">{scenarios.length}</Text>
            </Group>
          </Stack>

          <ScrollArea style={{ flex: 1, minHeight: 0 }} mt="xs">
            {scenariosLoading ? (
              <Stack gap={4}>
                {[1, 2, 3].map((i) => <Skeleton key={i} height={32} />)}
              </Stack>
            ) : scenariosError ? (
              <Alert color="red" size="xs">{scenariosError}</Alert>
            ) : (
              <Stack gap={2}>
                {scenarios.length === 0 ? (
                  <Text size="xs" c="dimmed" pl="xs">
                    {activeProjectId ? 'No scenarios yet' : 'Select a project'}
                  </Text>
                ) : (
                  scenarios.map((s) => (
                    <NavLink
                      key={s.id}
                      label={s.name}
                      active={s.id === activeId}
                      onClick={() => setActiveId(s.id)}
                      style={{ borderRadius: 'var(--mantine-radius-md)' }}
                      rightSection={
                        <Group gap={4} wrap="nowrap">
                          {s.reusable && (
                            <Badge size="xs" variant="light" color="teal">reusable</Badge>
                          )}
                          <Menu position="right-start" withinPortal>
                            <Menu.Target>
                              <ActionIcon
                                size="xs"
                                variant="subtle"
                                aria-label="Scenario options"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <IconDots size={12} />
                              </ActionIcon>
                            </Menu.Target>
                            <Menu.Dropdown>
                              <Menu.Item onClick={(e) => { e.stopPropagation(); openRenameModal(s) }}>
                                Rename
                              </Menu.Item>
                              <Menu.Item onClick={(e) => {
                                e.stopPropagation()
                                if (activeTeamId) updateScenario(activeTeamId, { ...s, reusable: !s.reusable })
                              }}>
                                {s.reusable ? 'Make a flow' : 'Make reusable'}
                              </Menu.Item>
                              <Menu.Item color="red" onClick={(e) => { e.stopPropagation(); openDeleteModal(s) }}>
                                Delete
                              </Menu.Item>
                            </Menu.Dropdown>
                          </Menu>
                        </Group>
                      }
                    />
                  ))
                )}
              </Stack>
            )}
          </ScrollArea>

          <Button
            variant="subtle"
            size="xs"
            leftSection={<IconPlus size={14} />}
            fullWidth
            disabled={!activeProjectId || !activeTeamId}
            mt="xs"
            style={{ flexShrink: 0 }}
            onClick={async () => {
              if (!activeTeamId || !activeProjectId) return
              const created = await createScenario(activeTeamId, activeProjectId, 'Untitled scenario')
              setActiveId(created.id)
            }}
          >
            New scenario
          </Button>
        </AppShell.Navbar>

        <AppShell.Aside p="md">
          <Stack gap="xs">
            <Text size="xs" tt="uppercase" c="dimmed" fw={600}>Context</Text>
            <ContextPanel />
          </Stack>
        </AppShell.Aside>

        <AppShell.Main>
          <Group justify="space-between" mb="md">
            <SegmentedControl
              size="xs"
              value={view}
              onChange={(v) => setView(v as 'blocks' | 'whatsnew' | 'apis' | 'schema')}
              data={[
                { label: 'Scenarios', value: 'blocks' },
                { label: 'API Blocks', value: 'apis' },
                { label: "What's new", value: 'whatsnew' },
                { label: 'Schema', value: 'schema' },
              ]}
            />
          </Group>

          {view === 'apis' && (
            <BlockDefsPanel
              localBlocks={localBlocks}
              onAdd={(block) => { upsertLocalBlock(block); setLocalBlocks(loadLocalBlocks()) }}
              onUpdate={(block) => { upsertLocalBlock(block); setLocalBlocks(loadLocalBlocks()) }}
              onDelete={(kind) => { deleteLocalBlock(kind); setLocalBlocks(loadLocalBlocks()) }}
            />
          )}

          {view === 'schema' && <SchemaDocsPanel />}
          {view === 'whatsnew' && <WhatsNewPanel />}

          {view === 'blocks' && (
            <>
              {active && (
                <Group mb="md">
                  <SegmentedControl
                    size="xs"
                    value={activeMode}
                    onChange={(v) => {
                      if (!active) return
                      if (v === 'graph') enableGraphMode(active)
                      else setGraphMode((m) => ({ ...m, [active.id]: 'list' }))
                    }}
                    data={[
                      { label: 'List', value: 'list' },
                      { label: 'Graph', value: 'graph' },
                    ]}
                  />
                </Group>
              )}

              {activeMode === 'graph' && active?.graphData && (
                <GraphCanvas
                  scenario={active}
                  allScenarios={scenarios}
                  readOnly={false}
                  onChange={updateActive}
                />
              )}

              {activeMode === 'list' && (
                <Stack gap="md">
                  {active ? (
                    <>
                      {active.blocks.map((b, i) => (
                        <div key={b.id}>
                          <BlockCard
                            block={b}
                            scenarios={scenarios}
                            onChange={(next) => {
                              const updatedBlocks = [...active.blocks]
                              updatedBlocks[i] = next
                              updateActive({ ...active, blocks: updatedBlocks })
                            }}
                            onRunFromHere={() => runFrom(i)}
                            onDuplicate={() => {
                              const clone = { ...b, id: crypto.randomUUID() }
                              const updatedBlocks = [...active.blocks]
                              updatedBlocks.splice(i + 1, 0, clone)
                              updateActive({ ...active, blocks: updatedBlocks })
                            }}
                            onRemove={() => {
                              updateActive({ ...active, blocks: active.blocks.filter((_, idx) => idx !== i) })
                            }}
                            onInsertBelow={() => setInsertAfterIdx(i)}
                          />
                          {insertAfterIdx === i && (
                            <AddBlockMenu
                              onAdd={(instance) => {
                                const updatedBlocks = [...active.blocks]
                                updatedBlocks.splice(i + 1, 0, instance)
                                updateActive({ ...active, blocks: updatedBlocks })
                                setInsertAfterIdx(null)
                              }}
                              scenarios={scenarios.filter((s) => s.id !== active.id)}
                              currentScenarioId={active.id}
                            />
                          )}
                        </div>
                      ))}
                      <AddBlockMenu
                        onAdd={(instance) => updateActive({ ...active, blocks: [...active.blocks, instance] })}
                        scenarios={scenarios.filter((s) => s.id !== active.id)}
                        currentScenarioId={active.id}
                      />
                    </>
                  ) : (
                    <Stack align="center" gap="xs" py="xl">
                      <ThemeIcon size={56} radius="xl" variant="light" color="gray">
                        <IconClipboardList size={28} />
                      </ThemeIcon>
                      <Text fw={600}>No scenario selected</Text>
                      <Text size="sm" c="dimmed" ta="center" maw={320}>
                        {activeProjectId
                          ? 'Pick a scenario from the sidebar, or create a new one.'
                          : 'Select or import a project to get started.'}
                      </Text>
                    </Stack>
                  )}
                </Stack>
              )}
            </>
          )}
        </AppShell.Main>
      </AppShell>

      <BurstDrawer
        opened={burstOpen}
        onClose={() => setBurstOpen(false)}
        scenario={active}
        deps={active ? burstDeps : null}
      />
      <CreateTeamModal />
    </RegistryProvider>
  )
}
```

- [ ] **Step 2: Delete old localStorage files**

```bash
rm apps/web/src/projects/ProjectsStore.tsx
rm apps/web/src/scenarios/storage.ts
```

- [ ] **Step 3: Fix any remaining references to deleted files**

Search for remaining imports:
```bash
grep -r "ProjectsStore\|scenarios/storage" apps/web/src --include="*.ts" --include="*.tsx"
```

Remove any remaining `import` lines that reference these deleted files.

- [ ] **Step 4: TypeScript check**

```bash
cd apps/web && pnpm exec tsc --noEmit
```

Fix any type errors before committing.

- [ ] **Step 5: Lint check**

```bash
cd apps/web && pnpm lint
```

Fix any lint errors.

- [ ] **Step 6: Verify in browser**

Start the server and frontend:
```bash
# Terminal 1
cd apps/server && pnpm dev

# Terminal 2
cd apps/web && pnpm dev
```

Verify:
- [ ] App shows login page on first load
- [ ] Register creates account and redirects to app
- [ ] No team → CreateTeamModal appears
- [ ] Create team → modal closes, project list loads
- [ ] Import a `.bundle.json` → project appears in selector
- [ ] Select project → scenarios load
- [ ] Create new scenario → appears in list
- [ ] Edit scenario blocks → changes persist (reload page to confirm)
- [ ] Delete scenario → removed from list
- [ ] Invalid bundle import → error details shown

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/App.tsx
git commit -m "feat: migrate App.tsx to Zustand stores, remove localStorage scenario state"
git add -A
git commit -m "chore: remove ProjectsStore.tsx and scenarios/storage.ts (replaced by Zustand stores)"
```
