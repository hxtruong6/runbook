# Bundle Signing + Public Registry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a registry system so providers can publish signed bundles and consumers can search, install, and verify them — closing the gap between local export and platform-level distribution.

**Architecture:** A new `registry_bundles` MongoDB collection stores full bundles alongside a SHA-256 hash computed from deterministically sorted JSON. The existing Fastify server gains a `/registry` prefix with five public/auth-gated routes. The web app gains Publish and From Registry UI wired into `ProjectSwitcher`. A standalone `packages/cli` workspace adds `runbook publish` and `runbook install` CLI commands.

**Tech Stack:** Node.js crypto (SHA-256), Fastify 4, MongoDB, Zod, React + Mantine, Zustand, Commander (CLI)

**No commits** — write code only.

---

## File Map

**New — Server**
- `apps/server/src/lib/bundleHash.ts` — SHA-256 hash utility
- `apps/server/src/routes/registry.ts` — registry CRUD routes
- `apps/server/tests/registry.test.ts` — Vitest tests

**Modified — Server**
- `apps/server/src/app.ts` — register `/registry` routes

**New — Web**
- `apps/web/src/api/registry.ts` — fetch wrappers for registry endpoints
- `apps/web/src/components/PublishBundleModal.tsx` — publish current project to registry
- `apps/web/src/components/ImportFromRegistryModal.tsx` — search + install from registry

**Modified — Web**
- `apps/web/src/projects/projectsStore.ts` — add `publishBundle` + `importBundleObject` actions
- `apps/web/src/components/ProjectSwitcher.tsx` — add Publish and From Registry buttons

**New — CLI**
- `packages/cli/package.json`
- `packages/cli/tsconfig.json`
- `packages/cli/src/index.ts` — Commander entry point
- `packages/cli/src/commands/publish.ts`
- `packages/cli/src/commands/install.ts`

---

## Task 1: Bundle hash utility

**Files:**
- Create: `apps/server/src/lib/bundleHash.ts`

- [ ] **Step 1: Create the hash utility**

```typescript
// apps/server/src/lib/bundleHash.ts
import { createHash } from 'node:crypto'

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value as object)
        .sort()
        .map((k) => [k, sortKeys((value as Record<string, unknown>)[k])])
    )
  }
  return value
}

export function computeBundleHash(bundle: unknown): string {
  const canonical = JSON.stringify(sortKeys(bundle))
  return createHash('sha256').update(canonical).digest('hex')
}

export function verifyBundleHash(bundle: unknown, hash: string): boolean {
  return computeBundleHash(bundle) === hash
}
```

- [ ] **Step 2: Verify the file compiles**

Run from repo root:
```bash
cd apps/server && npx tsc --noEmit
```
Expected: no errors

---

## Task 2: Registry routes

**Files:**
- Create: `apps/server/src/routes/registry.ts`

- [ ] **Step 1: Create the registry routes file**

```typescript
// apps/server/src/routes/registry.ts
import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { getDb } from '../db.js'
import { authenticate } from '../plugins/authenticate.js'
import { computeBundleHash, verifyBundleHash } from '../lib/bundleHash.js'

const BundleVersionSchema = z.object({
  version: z.string(),
  releasedAt: z.string(),
  releaseNotes: z.string().optional().default(''),
  changes: z.array(z.unknown()).default([]),
  blocks: z.array(z.unknown()).default([]),
  scenarios: z.array(z.unknown()).default([]),
  environments: z.array(z.unknown()).default([]),
  docs: z.record(z.string(), z.string()).optional().default({}),
})

const PublishBundleSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional().default(''),
  createdAt: z.string().optional().default(() => new Date().toISOString()),
  versions: z.array(BundleVersionSchema).min(1),
})

function getLatestVersion(versions: Array<{ version: string }>): string {
  return versions[versions.length - 1].version
}

export async function registryRoutes(app: FastifyInstance): Promise<void> {
  // POST /registry/publish — auth required
  app.post('/publish', { preHandler: [authenticate] }, async (req, reply) => {
    const user = req.user as { sub: string }
    const parsed = PublishBundleSchema.safeParse(req.body)
    if (!parsed.success) {
      const details = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
      return reply.code(400).send({ error: 'Invalid bundle', details })
    }

    const bundle = parsed.data
    const hash = computeBundleHash(bundle)
    const latestVersion = getLatestVersion(bundle.versions)
    const db = getDb()

    await db.collection('registry_bundles').updateOne(
      { bundleId: bundle.id },
      {
        $set: {
          bundleId: bundle.id,
          name: bundle.name,
          description: bundle.description,
          publisherId: user.sub,
          hash,
          bundle,
          publishedAt: new Date(),
          latestVersion,
        },
      },
      { upsert: true }
    )

    return reply.code(201).send({ bundleId: bundle.id, hash, latestVersion })
  })

  // GET /registry — public list (metadata only)
  app.get('/', async (_req, reply) => {
    const db = getDb()
    const entries = await db
      .collection('registry_bundles')
      .find({}, { projection: { bundle: 0, _id: 0 } })
      .sort({ publishedAt: -1 })
      .toArray()
    return reply.send(entries)
  })

  // GET /registry/search?q= — public name search
  app.get('/search', async (req, reply) => {
    const { q } = req.query as { q?: string }
    const db = getDb()
    const filter = q ? { name: { $regex: q, $options: 'i' } } : {}
    const entries = await db
      .collection('registry_bundles')
      .find(filter, { projection: { bundle: 0, _id: 0 } })
      .sort({ publishedAt: -1 })
      .limit(50)
      .toArray()
    return reply.send(entries)
  })

  // GET /registry/:bundleId — public, full bundle + hash
  app.get('/:bundleId', async (req, reply) => {
    const { bundleId } = req.params as { bundleId: string }
    const db = getDb()
    const entry = await db.collection('registry_bundles').findOne(
      { bundleId },
      { projection: { _id: 0 } }
    )
    if (!entry) return reply.code(404).send({ error: 'Not found' })
    return reply.send(entry)
  })

  // GET /registry/:bundleId/verify?hash= — public hash verification
  app.get('/:bundleId/verify', async (req, reply) => {
    const { bundleId } = req.params as { bundleId: string }
    const { hash } = req.query as { hash?: string }
    if (!hash) return reply.code(400).send({ error: 'hash query param required' })

    const db = getDb()
    const entry = await db.collection('registry_bundles').findOne({ bundleId })
    if (!entry) return reply.code(404).send({ error: 'Not found' })

    const valid = verifyBundleHash(entry['bundle'], hash)
    return reply.send({ valid })
  })
}
```

---

## Task 3: Registry tests

**Files:**
- Create: `apps/server/tests/registry.test.ts`

- [ ] **Step 1: Write registry tests**

```typescript
// apps/server/tests/registry.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { startTestDb, stopTestDb, buildApp } from './helpers.js'

const SAMPLE_BUNDLE = {
  id: 'test-bundle-001',
  name: 'Test Bundle',
  description: 'A test bundle',
  createdAt: '2026-01-01T00:00:00.000Z',
  versions: [
    {
      version: '1.0.0',
      releasedAt: '2026-01-01T00:00:00.000Z',
      releaseNotes: 'Initial release',
      changes: [],
      blocks: [],
      scenarios: [],
      environments: [],
      docs: {},
    },
  ],
}

async function registerAndLogin(app: ReturnType<typeof buildApp>, email: string) {
  await app.inject({
    method: 'POST',
    url: '/auth/register',
    payload: { email, name: 'Tester', password: 'password123' },
  })
  const res = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { email, password: 'password123' },
  })
  return (JSON.parse(res.body) as { token: string }).token
}

describe('Registry routes', () => {
  beforeAll(() => startTestDb())
  afterAll(() => stopTestDb())

  describe('POST /registry/publish', () => {
    it('returns 401 without auth', async () => {
      const app = buildApp()
      await app.ready()
      const res = await app.inject({
        method: 'POST',
        url: '/registry/publish',
        payload: SAMPLE_BUNDLE,
      })
      expect(res.statusCode).toBe(401)
      await app.close()
    })

    it('publishes a bundle and returns bundleId + hash', async () => {
      const app = buildApp()
      await app.ready()
      const token = await registerAndLogin(app, 'publisher@example.com')
      const res = await app.inject({
        method: 'POST',
        url: '/registry/publish',
        payload: SAMPLE_BUNDLE,
        headers: { authorization: `Bearer ${token}` },
      })
      expect(res.statusCode).toBe(201)
      const body = JSON.parse(res.body) as { bundleId: string; hash: string; latestVersion: string }
      expect(body.bundleId).toBe('test-bundle-001')
      expect(typeof body.hash).toBe('string')
      expect(body.hash).toHaveLength(64)
      expect(body.latestVersion).toBe('1.0.0')
      await app.close()
    })

    it('returns 400 for invalid bundle', async () => {
      const app = buildApp()
      await app.ready()
      const token = await registerAndLogin(app, 'publisher2@example.com')
      const res = await app.inject({
        method: 'POST',
        url: '/registry/publish',
        payload: { id: '', versions: [] },
        headers: { authorization: `Bearer ${token}` },
      })
      expect(res.statusCode).toBe(400)
      await app.close()
    })
  })

  describe('GET /registry', () => {
    it('lists published bundles without bundle content', async () => {
      const app = buildApp()
      await app.ready()
      const token = await registerAndLogin(app, 'lister@example.com')
      await app.inject({
        method: 'POST',
        url: '/registry/publish',
        payload: { ...SAMPLE_BUNDLE, id: 'list-test-bundle' },
        headers: { authorization: `Bearer ${token}` },
      })
      const res = await app.inject({ method: 'GET', url: '/registry' })
      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body) as unknown[]
      expect(Array.isArray(body)).toBe(true)
      expect(body.length).toBeGreaterThan(0)
      const entry = body[0] as Record<string, unknown>
      expect(entry['bundle']).toBeUndefined()
      expect(entry['bundleId']).toBeDefined()
      await app.close()
    })
  })

  describe('GET /registry/search', () => {
    it('filters bundles by name', async () => {
      const app = buildApp()
      await app.ready()
      const token = await registerAndLogin(app, 'searcher@example.com')
      await app.inject({
        method: 'POST',
        url: '/registry/publish',
        payload: { ...SAMPLE_BUNDLE, id: 'search-unique-xyz', name: 'Unique XYZ Bundle' },
        headers: { authorization: `Bearer ${token}` },
      })
      const res = await app.inject({ method: 'GET', url: '/registry/search?q=Unique+XYZ' })
      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body) as Array<Record<string, unknown>>
      expect(body.some((e) => e['bundleId'] === 'search-unique-xyz')).toBe(true)
      await app.close()
    })
  })

  describe('GET /registry/:bundleId', () => {
    it('returns full bundle and hash', async () => {
      const app = buildApp()
      await app.ready()
      const token = await registerAndLogin(app, 'getter@example.com')
      await app.inject({
        method: 'POST',
        url: '/registry/publish',
        payload: { ...SAMPLE_BUNDLE, id: 'get-test-bundle' },
        headers: { authorization: `Bearer ${token}` },
      })
      const res = await app.inject({ method: 'GET', url: '/registry/get-test-bundle' })
      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body) as Record<string, unknown>
      expect(body['bundleId']).toBe('get-test-bundle')
      expect(body['bundle']).toBeDefined()
      expect(typeof body['hash']).toBe('string')
      await app.close()
    })

    it('returns 404 for unknown bundleId', async () => {
      const app = buildApp()
      await app.ready()
      const res = await app.inject({ method: 'GET', url: '/registry/does-not-exist' })
      expect(res.statusCode).toBe(404)
      await app.close()
    })
  })

  describe('GET /registry/:bundleId/verify', () => {
    it('returns valid:true for correct hash', async () => {
      const app = buildApp()
      await app.ready()
      const token = await registerAndLogin(app, 'verifier@example.com')
      const publishRes = await app.inject({
        method: 'POST',
        url: '/registry/publish',
        payload: { ...SAMPLE_BUNDLE, id: 'verify-test-bundle' },
        headers: { authorization: `Bearer ${token}` },
      })
      const { hash } = JSON.parse(publishRes.body) as { hash: string }
      const res = await app.inject({ method: 'GET', url: `/registry/verify-test-bundle/verify?hash=${hash}` })
      expect(res.statusCode).toBe(200)
      expect(JSON.parse(res.body)).toEqual({ valid: true })
      await app.close()
    })

    it('returns valid:false for wrong hash', async () => {
      const app = buildApp()
      await app.ready()
      const token = await registerAndLogin(app, 'verifier2@example.com')
      await app.inject({
        method: 'POST',
        url: '/registry/publish',
        payload: { ...SAMPLE_BUNDLE, id: 'verify-test-bundle-2' },
        headers: { authorization: `Bearer ${token}` },
      })
      const res = await app.inject({
        method: 'GET',
        url: '/registry/verify-test-bundle-2/verify?hash=0000000000000000000000000000000000000000000000000000000000000000',
      })
      expect(res.statusCode).toBe(200)
      expect(JSON.parse(res.body)).toEqual({ valid: false })
      await app.close()
    })
  })
})
```

- [ ] **Step 2: Run the tests**

```bash
cd apps/server && pnpm test
```
Expected: all registry tests pass

---

## Task 4: Register registry routes in app.ts

**Files:**
- Modify: `apps/server/src/app.ts`

- [ ] **Step 1: Add registry routes registration**

```typescript
// apps/server/src/app.ts
import Fastify, { FastifyServerOptions } from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import { authRoutes } from './routes/auth.js'
import { teamsRoutes } from './routes/teams.js'
import { projectsRoutes } from './routes/projects.js'
import { scenariosRoutes } from './routes/scenarios.js'
import { registryRoutes } from './routes/registry.js'

export function buildApp(opts: FastifyServerOptions = {}) {
  const app = Fastify(opts)

  const jwtSecret = process.env['JWT_SECRET']
  if (!jwtSecret && process.env['NODE_ENV'] === 'production') {
    throw new Error('JWT_SECRET environment variable is required in production')
  }

  app.register(cors, { origin: true })
  app.register(jwt, { secret: jwtSecret ?? 'dev-secret' })

  app.register(authRoutes, { prefix: '/auth' })
  app.register(teamsRoutes, { prefix: '/teams' })
  app.register(projectsRoutes, { prefix: '/teams' })
  app.register(scenariosRoutes, { prefix: '/teams' })
  app.register(registryRoutes, { prefix: '/registry' })

  app.get('/health', async () => ({ status: 'ok' }))

  return app
}
```

- [ ] **Step 2: Run all server tests to confirm no regressions**

```bash
cd apps/server && pnpm test
```
Expected: all tests pass

---

## Task 5: Frontend registry API client

**Files:**
- Create: `apps/web/src/api/registry.ts`

- [ ] **Step 1: Create the registry API client**

```typescript
// apps/web/src/api/registry.ts
import { apiFetch, SERVER_BASE } from './client'
import type { ProjectBundle } from '../projects/types'

export type RegistryEntry = {
  bundleId: string
  name: string
  description: string
  publisherId: string
  hash: string
  publishedAt: string
  latestVersion: string
}

export type RegistryBundle = RegistryEntry & {
  bundle: ProjectBundle
}

export type PublishResult = {
  bundleId: string
  hash: string
  latestVersion: string
}

export function listRegistry(): Promise<RegistryEntry[]> {
  return apiFetch<RegistryEntry[]>(`${SERVER_BASE}/registry`)
}

export function searchRegistry(q: string): Promise<RegistryEntry[]> {
  const params = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''
  return apiFetch<RegistryEntry[]>(`${SERVER_BASE}/registry/search${params}`)
}

export function getRegistryBundle(bundleId: string): Promise<RegistryBundle> {
  return apiFetch<RegistryBundle>(`${SERVER_BASE}/registry/${encodeURIComponent(bundleId)}`)
}

export function publishBundle(bundle: ProjectBundle): Promise<PublishResult> {
  return apiFetch<PublishResult>(`${SERVER_BASE}/registry/publish`, {
    method: 'POST',
    body: JSON.stringify(bundle),
  })
}

export function verifyRegistryBundle(bundleId: string, hash: string): Promise<{ valid: boolean }> {
  return apiFetch<{ valid: boolean }>(
    `${SERVER_BASE}/registry/${encodeURIComponent(bundleId)}/verify?hash=${encodeURIComponent(hash)}`
  )
}
```

---

## Task 6: Add publishBundle and importBundleObject to projectsStore

**Files:**
- Modify: `apps/web/src/projects/projectsStore.ts`

- [ ] **Step 1: Update projectsStore with new actions**

Replace the full file content:

```typescript
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

  async publishBundle(teamId, scenarios) {
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
```

---

## Task 7: PublishBundleModal component

**Files:**
- Create: `apps/web/src/components/PublishBundleModal.tsx`

- [ ] **Step 1: Create the publish modal**

```typescript
// apps/web/src/components/PublishBundleModal.tsx
import { useState } from 'react'
import { Alert, Button, Code, Group, Modal, Stack, Text } from '@mantine/core'
import { IconCheck, IconCloudUpload } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useProjectsStore } from '../projects/projectsStore'
import { useScenariosStore } from '../scenarios/scenariosStore'
import { useTeamStore } from '../teams/teamStore'

type Props = {
  opened: boolean
  onClose: () => void
}

export function PublishBundleModal({ opened, onClose }: Props) {
  const { projects, activeProjectId, publishing } = useProjectsStore()
  const { scenarios } = useScenariosStore()
  const { activeTeamId } = useTeamStore()
  const [publishedHash, setPublishedHash] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const project = projects.find((p) => p._id === activeProjectId)

  async function handlePublish() {
    if (!activeTeamId) return
    setError(null)
    setPublishedHash(null)
    try {
      const result = await useProjectsStore.getState().publishBundle(activeTeamId, scenarios)
      setPublishedHash(result.hash)
      notifications.show({ color: 'green', message: `Published ${result.bundleId} @ ${result.latestVersion}` })
    } catch (e) {
      setError((e as Error).message)
    }
  }

  function handleClose() {
    setPublishedHash(null)
    setError(null)
    onClose()
  }

  return (
    <Modal opened={opened} onClose={handleClose} title="Publish to Registry">
      <Stack gap="md">
        {!project ? (
          <Alert color="red">No active project selected.</Alert>
        ) : publishedHash ? (
          <>
            <Alert color="green" icon={<IconCheck size={16} />} title="Published">
              <Text size="sm" mb={4}>Bundle published successfully.</Text>
              <Text size="xs" c="dimmed" mb={4}>SHA-256 hash:</Text>
              <Code block style={{ wordBreak: 'break-all', fontSize: 11 }}>{publishedHash}</Code>
            </Alert>
            <Button variant="default" onClick={handleClose}>Close</Button>
          </>
        ) : (
          <>
            <Stack gap={4}>
              <Text size="sm"><strong>Project:</strong> {project.name}</Text>
              <Text size="sm"><strong>Versions:</strong> {(project.versions ?? []).length || '—'}</Text>
              <Text size="sm"><strong>Scenarios:</strong> {scenarios.length}</Text>
            </Stack>
            <Text size="xs" c="dimmed">
              This will publish the current project as a bundle to the registry. Anyone with access to this server can download and install it.
            </Text>
            {error && <Alert color="red">{error}</Alert>}
            <Group justify="flex-end">
              <Button variant="default" onClick={handleClose}>Cancel</Button>
              <Button
                leftSection={<IconCloudUpload size={16} />}
                loading={publishing}
                onClick={handlePublish}
              >
                Publish
              </Button>
            </Group>
          </>
        )}
      </Stack>
    </Modal>
  )
}
```

---

## Task 8: ImportFromRegistryModal component

**Files:**
- Create: `apps/web/src/components/ImportFromRegistryModal.tsx`

- [ ] **Step 1: Create the import from registry modal**

```typescript
// apps/web/src/components/ImportFromRegistryModal.tsx
import { useEffect, useState, useRef } from 'react'
import {
  Alert, Badge, Button, Group, Loader, Modal, ScrollArea,
  Stack, Text, TextInput,
} from '@mantine/core'
import { IconSearch, IconCloudDownload, IconCheck } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { listRegistry, searchRegistry, getRegistryBundle, verifyRegistryBundle, type RegistryEntry } from '../api/registry'
import { useProjectsStore } from '../projects/projectsStore'
import { useTeamStore } from '../teams/teamStore'

type Props = {
  opened: boolean
  onClose: () => void
}

export function ImportFromRegistryModal({ opened, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [entries, setEntries] = useState<RegistryEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [installing, setInstalling] = useState<string | null>(null)
  const [installed, setInstalled] = useState<Set<string>>(new Set())
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { activeTeamId } = useTeamStore()
  const { importing } = useProjectsStore()

  async function fetchEntries(q: string) {
    setLoading(true)
    setError(null)
    try {
      const results = q.trim() ? await searchRegistry(q) : await listRegistry()
      setEntries(results)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!opened) return
    fetchEntries('')
  }, [opened])

  function handleQueryChange(q: string) {
    setQuery(q)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchEntries(q), 300)
  }

  async function handleInstall(entry: RegistryEntry) {
    if (!activeTeamId) return
    setInstalling(entry.bundleId)
    setError(null)
    try {
      const full = await getRegistryBundle(entry.bundleId)
      const { valid } = await verifyRegistryBundle(entry.bundleId, full.hash)
      if (!valid) throw new Error('Bundle hash verification failed — bundle may be corrupted')
      await useProjectsStore.getState().importBundleObject(full.bundle, activeTeamId)
      setInstalled((s) => new Set([...s, entry.bundleId]))
      notifications.show({ color: 'green', message: `Installed "${entry.name}"` })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setInstalling(null)
    }
  }

  function handleClose() {
    setQuery('')
    setEntries([])
    setError(null)
    setInstalled(new Set())
    onClose()
  }

  return (
    <Modal opened={opened} onClose={handleClose} title="Import from Registry" size="lg">
      <Stack gap="md">
        <TextInput
          placeholder="Search bundles…"
          leftSection={<IconSearch size={16} />}
          value={query}
          onChange={(e) => handleQueryChange(e.currentTarget.value)}
        />

        {error && <Alert color="red">{error}</Alert>}

        {loading ? (
          <Group justify="center" py="xl"><Loader size="sm" /></Group>
        ) : entries.length === 0 ? (
          <Text size="sm" c="dimmed" ta="center" py="xl">
            {query ? 'No bundles match your search.' : 'Registry is empty.'}
          </Text>
        ) : (
          <ScrollArea.Autosize mah={400}>
            <Stack gap="xs">
              {entries.map((entry) => (
                <Group key={entry.bundleId} justify="space-between" p="sm" style={{ border: '1px solid var(--mantine-color-default-border)', borderRadius: 'var(--mantine-radius-md)' }}>
                  <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
                    <Group gap="xs">
                      <Text size="sm" fw={600}>{entry.name}</Text>
                      <Badge size="xs" variant="light" color="teal">{entry.latestVersion}</Badge>
                    </Group>
                    {entry.description && (
                      <Text size="xs" c="dimmed" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {entry.description}
                      </Text>
                    )}
                    <Text size="xs" c="dimmed" ff="monospace">
                      {entry.hash.slice(0, 12)}…
                    </Text>
                  </Stack>
                  {installed.has(entry.bundleId) ? (
                    <Button size="xs" variant="light" color="green" leftSection={<IconCheck size={14} />} disabled>
                      Installed
                    </Button>
                  ) : (
                    <Button
                      size="xs"
                      variant="light"
                      leftSection={<IconCloudDownload size={14} />}
                      loading={installing === entry.bundleId || importing}
                      onClick={() => handleInstall(entry)}
                    >
                      Install
                    </Button>
                  )}
                </Group>
              ))}
            </Stack>
          </ScrollArea.Autosize>
        )}
      </Stack>
    </Modal>
  )
}
```

---

## Task 9: Wire UI into ProjectSwitcher

**Files:**
- Modify: `apps/web/src/components/ProjectSwitcher.tsx`

- [ ] **Step 1: Add Publish and From Registry buttons to ProjectSwitcher**

Replace the full file:

```typescript
// apps/web/src/components/ProjectSwitcher.tsx
import { useRef, useState } from 'react'
import { Alert, Button, Group, Select, Skeleton, Stack, Text, TextInput } from '@mantine/core'
import { openConfirmModal, modals } from '@mantine/modals'
import { notifications } from '@mantine/notifications'
import { useProjectsStore } from '../projects/projectsStore'
import { useTeamStore } from '../teams/teamStore'
import { PublishBundleModal } from './PublishBundleModal'
import { ImportFromRegistryModal } from './ImportFromRegistryModal'

export function ProjectSwitcher() {
  const { projects, activeProjectId, setActiveProject, deleteProject, createProject, importBundle, loading, importing, importErrors, error } =
    useProjectsStore()
  const { activeTeamId } = useTeamStore()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [publishOpen, setPublishOpen] = useState(false)
  const [registryOpen, setRegistryOpen] = useState(false)

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

  function handleNewProject() {
    if (!activeTeamId) return
    let name = ''
    modals.open({
      title: 'New project',
      children: (
        <form
          onSubmit={async (e) => {
            e.preventDefault()
            const trimmed = name.trim()
            if (!trimmed) return
            try {
              await createProject(activeTeamId, trimmed)
              modals.closeAll()
            } catch {
              notifications.show({ color: 'red', message: 'Failed to create project' })
            }
          }}
        >
          <TextInput
            placeholder="Project name"
            onChange={(ev) => { name = ev.currentTarget.value }}
            data-autofocus
            mb="sm"
          />
          <Button type="submit" size="sm" fullWidth>Create</Button>
        </form>
      ),
    })
  }

  return (
    <>
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
            placeholder={options.length === 0 ? 'No projects yet' : 'Select project'}
            disabled={options.length === 0}
            comboboxProps={{ withinPortal: true }}
            styles={{ input: { fontWeight: 500 } }}
          />
        )}

        {error && <Alert color="red" variant="light">{error}</Alert>}
        {importErrors.length > 0 && (
          <Alert color="red" title="Import errors">
            {importErrors.map((e, i) => <Text key={i} size="xs">{e}</Text>)}
          </Alert>
        )}

        <Group gap="xs" wrap="wrap">
          <Button size="xs" variant="default" disabled={!activeTeamId} onClick={handleNewProject}>
            New project
          </Button>
          <Button size="xs" variant="default" loading={importing} onClick={() => fileInputRef.current?.click()}>
            Import bundle
          </Button>
          <Button size="xs" variant="default" disabled={!activeTeamId} onClick={() => setRegistryOpen(true)}>
            From Registry
          </Button>
          <Button size="xs" variant="light" disabled={!activeProjectId} onClick={() => setPublishOpen(true)}>
            Publish
          </Button>
          <Button size="xs" variant="subtle" color="red" disabled={!activeProjectId} onClick={handleDelete}>
            Delete
          </Button>
        </Group>

        <input ref={fileInputRef} type="file" accept="application/json" hidden onChange={handleImport} />
      </Stack>

      <PublishBundleModal opened={publishOpen} onClose={() => setPublishOpen(false)} />
      <ImportFromRegistryModal opened={registryOpen} onClose={() => setRegistryOpen(false)} />
    </>
  )
}
```

---

## Task 10: CLI package scaffold

**Files:**
- Create: `packages/cli/package.json`
- Create: `packages/cli/tsconfig.json`
- Create: `packages/cli/src/index.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@runbook/cli",
  "version": "0.1.0",
  "description": "Runbook CLI — publish and install bundles",
  "type": "module",
  "bin": {
    "runbook": "./dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsx src/index.ts"
  },
  "dependencies": {
    "commander": "^12.1.0"
  },
  "devDependencies": {
    "tsx": "^4.19.2",
    "typescript": "^5.6.3"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create src/index.ts entry point**

```typescript
#!/usr/bin/env node
// packages/cli/src/index.ts
import { Command } from 'commander'
import { publishCommand } from './commands/publish.js'
import { installCommand } from './commands/install.js'

const program = new Command()

program
  .name('runbook')
  .description('Runbook CLI — publish and install API workflow bundles')
  .version('0.1.0')

program.addCommand(publishCommand)
program.addCommand(installCommand)

program.parse()
```

- [ ] **Step 4: Install CLI dependencies**

```bash
cd packages/cli && pnpm install
```
Expected: `node_modules` created with `commander`

---

## Task 11: CLI publish command

**Files:**
- Create: `packages/cli/src/commands/publish.ts`

- [ ] **Step 1: Create the publish command**

```typescript
// packages/cli/src/commands/publish.ts
import { Command } from 'commander'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

export const publishCommand = new Command('publish')
  .description('Publish a bundle file to the Runbook registry')
  .argument('<file>', 'Path to the .bundle.json file')
  .requiredOption('--server <url>', 'Registry server URL (e.g. http://localhost:3001)')
  .requiredOption('--token <jwt>', 'JWT auth token')
  .action(async (file: string, opts: { server: string; token: string }) => {
    const filePath = resolve(file)

    let rawText: string
    try {
      rawText = await readFile(filePath, 'utf-8')
    } catch {
      console.error(`Error: Cannot read file "${filePath}"`)
      process.exit(1)
    }

    let bundle: unknown
    try {
      bundle = JSON.parse(rawText)
    } catch {
      console.error('Error: File is not valid JSON')
      process.exit(1)
    }

    const url = `${opts.server.replace(/\/$/, '')}/registry/publish`

    let res: Response
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${opts.token}`,
        },
        body: JSON.stringify(bundle),
      })
    } catch (e) {
      console.error(`Error: Could not reach server at ${opts.server}`)
      console.error((e as Error).message)
      process.exit(1)
    }

    const body = await res.json() as Record<string, unknown>

    if (!res.ok) {
      console.error(`Error: Server returned ${res.status}`)
      console.error(JSON.stringify(body, null, 2))
      process.exit(1)
    }

    console.log(`✓ Published`)
    console.log(`  Bundle ID  : ${body['bundleId']}`)
    console.log(`  Version    : ${body['latestVersion']}`)
    console.log(`  SHA-256    : ${body['hash']}`)
  })
```

---

## Task 12: CLI install command

**Files:**
- Create: `packages/cli/src/commands/install.ts`

- [ ] **Step 1: Create the install command**

```typescript
// packages/cli/src/commands/install.ts
import { Command } from 'commander'
import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createHash } from 'node:crypto'

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value as object)
        .sort()
        .map((k) => [k, sortKeys((value as Record<string, unknown>)[k])])
    )
  }
  return value
}

function computeHash(bundle: unknown): string {
  return createHash('sha256').update(JSON.stringify(sortKeys(bundle))).digest('hex')
}

export const installCommand = new Command('install')
  .description('Download and verify a bundle from the Runbook registry')
  .argument('<bundleId>', 'Bundle ID to install')
  .requiredOption('--server <url>', 'Registry server URL (e.g. http://localhost:3001)')
  .option('--output <file>', 'Output file path (default: <bundleId>.bundle.json)')
  .action(async (bundleId: string, opts: { server: string; output?: string }) => {
    const url = `${opts.server.replace(/\/$/, '')}/registry/${encodeURIComponent(bundleId)}`

    let res: Response
    try {
      res = await fetch(url)
    } catch (e) {
      console.error(`Error: Could not reach server at ${opts.server}`)
      console.error((e as Error).message)
      process.exit(1)
    }

    if (res.status === 404) {
      console.error(`Error: Bundle "${bundleId}" not found in registry`)
      process.exit(1)
    }

    if (!res.ok) {
      console.error(`Error: Server returned ${res.status}`)
      process.exit(1)
    }

    const body = await res.json() as { bundle: unknown; hash: string; bundleId: string; latestVersion: string }

    const computedHash = computeHash(body.bundle)
    if (computedHash !== body.hash) {
      console.error('Error: Hash verification failed — bundle may be corrupted or tampered with')
      console.error(`  Expected : ${body.hash}`)
      console.error(`  Got      : ${computedHash}`)
      process.exit(1)
    }

    const outputPath = resolve(opts.output ?? `${bundleId}.bundle.json`)
    await writeFile(outputPath, JSON.stringify(body.bundle, null, 2), 'utf-8')

    console.log(`✓ Installed`)
    console.log(`  Bundle ID  : ${body.bundleId}`)
    console.log(`  Version    : ${body.latestVersion}`)
    console.log(`  SHA-256    : ${body.hash} ✓ verified`)
    console.log(`  Saved to   : ${outputPath}`)
  })
```

- [ ] **Step 2: Verify CLI builds**

```bash
cd packages/cli && pnpm build
```
Expected: `dist/` folder created with compiled JS files

---

## Self-Review Notes

- All 12 tasks produce independently verifiable output (compile check, test run, or visual output)
- Types are consistent: `ProjectBundle` from `apps/web/src/projects/types.ts` used in registry API client and store
- `buildBundleForPublish` in the store correctly maps `ApiProjectVersion` → `ProjectVersion` including the `scenarios` array
- `computeBundleHash` / `computeHash` (CLI) use identical algorithm — deterministic key sort + SHA-256 — so CLI install can verify hashes produced by server publish
- `importBundleObject` refactors the existing `importBundle` logic cleanly without breaking the File-based path
- No placeholder steps — every step has full code
