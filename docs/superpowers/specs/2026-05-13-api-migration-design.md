# API Migration Design — Local → Server-backed

**Date:** 2026-05-13
**Status:** Approved

## Overview

Replace the entirely offline/localStorage-based frontend with a fully API-backed system. Projects and scenarios are loaded from and persisted to the Fastify backend. The import feature remains but now uploads and unpacks a bundle JSON into the database instead of localStorage. All state management migrates from Context/useReducer to Zustand stores.

---

## Section 1 — Auth Store & Login UI

### Goal
Gate the entire app behind authentication. Nothing loads until a valid JWT is present.

### Files

| File | Role |
|------|------|
| `src/auth/authStore.ts` | Zustand store: `user`, `token`, `login()`, `logout()`, `register()` |
| `src/auth/LoginPage.tsx` | Login / Register tabs. On success: token stored, app renders. |

### Behaviour
- `authStore` uses Zustand `persist` middleware → token saved to `localStorage` under `runbook:token`.
- On mount, if token exists in storage, treat user as logged in (no `/auth/me` needed — 401 from any API call auto-calls `logout()`).
- `src/App.tsx` reads `token` from `authStore`. If falsy, renders `<LoginPage>`. Otherwise renders the app shell.
- No `Provider` wrappers needed — Zustand stores are module singletons.

---

## Section 2 — Team Store

### Goal
After login, resolve which team the user is working in. All project/scenario API calls require a `teamId`.

### Files

| File | Role |
|------|------|
| `src/teams/teamStore.ts` | Zustand store: `teams[]`, `activeTeamId`, `needsTeam`, `fetchTeams()`, `createTeam()`, `setActiveTeam()` |
| `src/teams/CreateTeamModal.tsx` | Shown when `needsTeam === true`. Single name input → `createTeam()`. |

### Behaviour
- `fetchTeams()` is called immediately after login.
- If response is empty → `needsTeam = true` → `CreateTeamModal` blocks the app until a team is created.
- If one or more teams exist → auto-select first, `needsTeam = false`.
- `TopBar` shows a team-switcher `<Select>` when `teams.length > 1`. Calls `setActiveTeam()`.
- `activeTeamId` is the prerequisite for loading projects and scenarios.

---

## Section 3 — Projects & Scenarios Stores

### Goal
Replace localStorage-backed stores with API-backed Zustand stores. Pure API — no local cache.

### Files

| File | Role |
|------|------|
| `src/projects/projectsStore.ts` | Replaces `ProjectsStore.tsx` |
| `src/scenarios/scenariosStore.ts` | Replaces `scenarios/storage.ts` |

### Projects store shape
```ts
{
  projects: ApiProject[]     // list from GET /teams/:teamId/projects
  activeProjectId: string | null
  loading: boolean
  error: string | null
  fetchProjects(teamId: string): Promise<void>
  deleteProject(teamId: string, projectId: string): Promise<void>
  setActiveProject(id: string | null): void
}
```

### Scenarios store shape
```ts
{
  scenarios: ApiScenario[]   // list from GET /teams/:teamId/scenarios
  loading: boolean
  error: string | null
  fetchScenarios(teamId: string, projectId: string): Promise<void>
  createScenario(teamId: string, data: CreateScenario): Promise<void>
  updateScenario(teamId: string, id: string, patch: Operation[]): Promise<void>
  deleteScenario(teamId: string, id: string): Promise<void>
}
```

### Behaviour
- `fetchProjects()` triggers when `activeTeamId` changes.
- `fetchScenarios()` triggers when `activeProjectId` changes.
- On error: store sets `error` string; components render `<Alert>` with retry action.
- On loading: components render `<Skeleton>`.

### Removed files
- `src/projects/ProjectsStore.tsx` (Context/useReducer)
- `src/scenarios/storage.ts` (localStorage)

### Kept files
- `src/projects/types.ts` — `ProjectBundle` type remains as the import/export wire format.

---

## Section 4 — Bundle Import

### Goal
Import a `.bundle.json` file by unpacking it and saving each entity to the database atomically via a dedicated server endpoint.

### Server — new endpoint
`POST /teams/:teamId/projects/import`

**Request body:** full `ProjectBundle` JSON

**Server behaviour:**
1. Validate the entire body against `ProjectBundleSchema` (Zod). On failure: return `400` with a structured error:
   ```json
   { "error": "Invalid bundle", "details": ["versions[1].scenarios[3].blocks[0]: unknown kind \"foo\""] }
   ```
2. Create one project record in `projects` collection.
3. For each version, insert all scenarios into `scenarios` collection with `projectId` + `teamId`.
4. Return `{ project, scenarios[] }` on success.

All DB writes happen in sequence; if any insert fails, return `500` with a message describing which step failed.

### Frontend
- `projectsStore` gains an `importBundle(file: File, teamId: string): Promise<void>` action.
- Reads and JSON-parses the file, validates as `ProjectBundle` client-side first (early feedback).
- POSTs to the import endpoint.
- On structured `400`: surfaces `details[]` in a `<Alert color="red">` listing each validation error.
- On success: calls `fetchProjects()` + `fetchScenarios()` to refresh.
- `ProjectSwitcher` Import button wires to `importBundle()`.

---

## Section 5 — API Client Layer

### Goal
All Zustand stores call typed API functions — never `fetch` directly. One place for auth headers, error normalisation, and 401 handling.

### Files

| File | Exports |
|------|---------|
| `src/api/client.ts` | `apiFetch<T>(path, init?)` — injects Bearer token, throws typed `ApiError` on non-2xx, calls `authStore.logout()` on 401 |
| `src/api/auth.ts` | `postLogin()`, `postRegister()` |
| `src/api/teams.ts` | `getTeams()`, `postTeam()` |
| `src/api/projects.ts` | `getProjects()`, `postImportBundle()`, `deleteProject()` |
| `src/api/scenarios.ts` | `getScenarios()`, `postScenario()`, `patchScenario()`, `deleteScenario()` |

### ApiError type
```ts
class ApiError extends Error {
  constructor(public status: number, message: string) { super(message) }
}
```

---

## Data Flow Summary

```
Login → authStore.token set
      → teamStore.fetchTeams()
          → empty? → CreateTeamModal → teamStore.createTeam()
          → exists? → teamStore.activeTeamId set
                    → projectsStore.fetchProjects(teamId)
                        → activeProjectId set
                        → scenariosStore.fetchScenarios(teamId, projectId)

Import → projectsStore.importBundle(file, teamId)
       → POST /teams/:teamId/projects/import
       → fetchProjects() + fetchScenarios() refresh
```

---

## What Changes vs What Stays

| | Before | After |
|--|--------|-------|
| Auth | None | `authStore` + `LoginPage` |
| Team context | None | `teamStore` + `CreateTeamModal` |
| Projects | localStorage bundles | API via `projectsStore` |
| Scenarios | localStorage | API via `scenariosStore` |
| Import | Loads to localStorage | POSTs to server, unpacks to DB |
| Export | Downloads bundle JSON | Unchanged |
| State mgmt | Context + useReducer | Zustand stores |
| API calls | None | `src/api/` typed client |

## Dependencies to add
- `zustand` (frontend)
- `fast-json-patch` already present on server for scenario PATCH

No other new dependencies.
