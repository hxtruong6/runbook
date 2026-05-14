# Runbook — Feature Roadmap

Five high-impact features that are missing or incomplete, ordered by priority. Tackle one at a time.

---

## Feature 1 — Bundle Signing + Public Registry

**Priority:** Critical (P0)  
**Status:** Not started  
**Roadmap tier:** Now

### Problem
Bundle export/import works locally (`apps/web/src/projects/exportImport.ts`) but there is no signing, no CLI, and no registry. Providers cannot distribute bundles to consumers. Runbook is a local tool, not a platform.

### What needs to be built
- **Bundle signing** — deterministic SHA-256 or ed25519 signature over the bundle payload, stored in a `signature` field. Consumers can verify the bundle hasn't been tampered with.
- **`runbook publish`** — CLI command that signs and uploads a bundle to the registry.
- **`runbook install <id>@<version>`** — CLI command that downloads and verifies a bundle.
- **Registry API** (server-side) — routes for publish, lookup by ID + semver, and download. Can start as a simple MongoDB collection (`bundles`).
- **Import from registry UI** — a search/picker in the frontend to pull a published bundle into a workspace.

### Why it matters
This is the core distribution moat. Every other part of the pitch (partner onboarding, versioned diffs, ecosystem) depends on bundles being distributable. Without it the product is a sophisticated local runner.

### Entry points
- `apps/web/src/projects/exportImport.ts` — extend to support signed export
- `apps/server/src/routes/` — add `registry.ts`
- New `packages/cli/` workspace for the CLI

### Sub-tasks

#### ST-1: Bundle hash utility (server)
- Create `apps/server/src/lib/bundleHash.ts`
- Export `computeBundleHash(bundle: unknown): string` — SHA-256 of deterministically sorted JSON
- Export `verifyBundleHash(bundle: unknown, hash: string): boolean`

#### ST-2: Registry routes (server)
- Create `apps/server/src/routes/registry.ts`
- `POST /registry/publish` (JWT auth) — validate bundle, compute hash, upsert `registry_bundles` collection by `bundleId`
- `GET /registry` (public) — list all entries, metadata only (no full bundle)
- `GET /registry/search?q=` (public) — case-insensitive name search
- `GET /registry/:bundleId` (public) — return full bundle + hash
- `GET /registry/:bundleId/verify?hash=` (public) — return `{ valid: boolean }`

#### ST-3: Registry tests (server)
- Create `apps/server/tests/registry.test.ts`
- Test: publish returns 201 with hash
- Test: publish without auth returns 401
- Test: list returns published bundles
- Test: search filters by name
- Test: get by bundleId returns full bundle
- Test: verify returns `{ valid: true }` for correct hash, `{ valid: false }` for wrong hash

#### ST-4: Register routes in app.ts
- Modify `apps/server/src/app.ts` — add `import { registryRoutes }` and register at `/registry`

#### ST-5: Frontend registry API client
- Create `apps/web/src/api/registry.ts`
- Export `RegistryEntry` and `RegistryBundle` types
- Export `listRegistry()`, `searchRegistry(q)`, `getRegistryBundle(bundleId)`, `publishBundle(bundle)`

#### ST-6: Add publishBundle to projectsStore
- Modify `apps/web/src/projects/projectsStore.ts`
- Add `publishBundle(teamId: string): Promise<{ hash: string }>` action
- Add `importBundleObject(bundle: ProjectBundle, teamId: string): Promise<void>` action (bypasses File reading)
- Helper: `buildBundleForPublish(project, scenarios)` constructs a valid `ProjectBundle`

#### ST-7: PublishBundleModal component
- Create `apps/web/src/components/PublishBundleModal.tsx`
- Shows project name, version count, scenario count
- "Publish" button → calls `publishBundle`, shows returned hash in success state
- Error state with retry

#### ST-8: ImportFromRegistryModal component
- Create `apps/web/src/components/ImportFromRegistryModal.tsx`
- Search input → debounced call to `searchRegistry(q)` (or `listRegistry()` when empty)
- Results list: name, description, latestVersion, hash snippet
- "Install" button → fetches full bundle, verifies hash, calls `importBundleObject`

#### ST-9: Wire UI into ProjectSwitcher
- Modify `apps/web/src/components/ProjectSwitcher.tsx`
- Add "Publish" button (variant="light") → opens `PublishBundleModal`
- Add "From Registry" button (variant="default") → opens `ImportFromRegistryModal`

#### ST-10: CLI package scaffold
- Create `packages/cli/package.json` with `commander` dependency
- Create `packages/cli/tsconfig.json`
- Create `packages/cli/src/index.ts` — entry point wiring `publish` and `install` sub-commands

#### ST-11: CLI publish command
- Create `packages/cli/src/commands/publish.ts`
- `runbook publish <file> --server <url> --token <jwt>`
- Reads bundle file, POSTs to `POST /registry/publish`, prints bundleId + hash

#### ST-12: CLI install command
- Create `packages/cli/src/commands/install.ts`
- `runbook install <bundleId> --server <url> [--output <file>]`
- Fetches from `GET /registry/:bundleId`, verifies hash locally, writes `.bundle.json`

---

## Feature 2 — OpenAPI → Blocks Importer

**Priority:** High (P1)  
**Status:** Not started  
**Roadmap tier:** Next

### Problem
Block definitions are hand-authored today. There is no way to ingest an existing API spec and generate a block library from it. Every new API provider starts from zero.

### What needs to be built
- **Parser** — read an OpenAPI 3.x document (URL or file upload), extract operations (`operationId`, path, method, parameters, requestBody, responses).
- **Mapper** — convert each operation into a `BlockDef` (inputs from parameters + requestBody schema, output from response schema, URL template from path + servers).
- **Review UI** — show the user a list of generated blocks to accept, edit, or discard before committing.
- **Auth inference** — detect `securitySchemes` (bearer, apiKey, OAuth2) and pre-fill the environment auth fields.

### Why it matters
Biggest adoption wedge. Any API with an OpenAPI spec (the vast majority of API-first companies) can generate a full block library in one click. Eliminates the cold-start problem for new providers and makes the "import a Stripe/Twilio/etc. bundle" demo possible.

### Entry points
- `apps/web/src/blocks/types.ts` — `BlockDef` type to map to
- `apps/web/src/components/BlockEditorModal.tsx` — existing block form to pre-populate
- New `apps/web/src/blocks/openApiImporter.ts`

---

## Feature 3 — Run History & Audit Logs

**Priority:** High (P1)  
**Status:** Not started  
**Roadmap tier:** +1 (Hosted team workspaces)

### Problem
All scenario execution is client-side and ephemeral. Nothing is persisted. There is no `runs` collection, no history endpoint, and no UI showing past executions.

### What needs to be built
- **`runs` collection** (MongoDB) — store each execution: `scenarioId`, `projectId`, `teamId`, `triggeredBy`, `startedAt`, `finishedAt`, `status` (success / error / partial), `blockResults[]` (block ID, status, response summary).
- **Server route** — `POST /:teamId/projects/:projectId/runs` to record a run; `GET` to paginate history.
- **Execution hook** (frontend) — after `runScenario` completes, POST the result to the server if a team session is active.
- **Run history panel** — sidebar or tab showing past runs with status, timestamp, triggered-by, and a drill-down to per-block results.
- **Audit log view** — filterable table of who ran what and when, for admin users.

### Why it matters
Gate to enterprise sales and the Team SaaS tier. Compliance and platform teams ask "what changed, when, by whom" before signing any contract. Also the foundation for alerting (e.g. notify when a nightly run fails).

### Entry points
- `apps/server/src/routes/scenarios.ts` — add run recording alongside patch
- `apps/web/src/execution/runScenario.ts` — post-run hook
- New `apps/web/src/components/RunHistoryPanel.tsx`

---

## Feature 4 — MCP Integration (Bundles as AI Agent Tool Surfaces)

**Priority:** High (P1)  
**Status:** Not started  
**Roadmap tier:** +2

### Problem
There is no way to expose a Runbook bundle as an MCP (Model Context Protocol) tool surface. AI agents cannot discover or call typed Runbook workflows natively.

### What needs to be built
- **MCP server adapter** — given a bundle, generate an MCP `tools` manifest where each block becomes a tool (name, description, input schema from `BlockDef.inputs`, output schema from `BlockDef.outputPath`).
- **Execution bridge** — when an MCP client calls a tool, resolve the block, inject context (environment, auth), and run it via the existing `runBlock` executor.
- **`runbook serve`** — CLI command (or server route) that starts an MCP-compatible HTTP/SSE endpoint for a given bundle ID.
- **UI affordance** — "Expose as MCP" toggle on a project, showing the endpoint URL and a copy-paste snippet for Claude / Cursor / etc.

### Why it matters
Highest-leverage growth driver right now. First-mover window is open — no major competitor has a versioned, typed, executable bundle format that maps cleanly to MCP tools. This makes the "AI agents need executable contracts" section of the pitch concrete and demoable.

### Entry points
- `apps/web/src/execution/runScenario.ts` → `runBlock` — reuse as the execution layer
- `apps/web/src/blocks/types.ts` — `BlockDef` maps directly to MCP tool schema
- New `packages/mcp-adapter/` workspace

---

## Feature 5 — Team Member Management UI (RBAC Front-End)

**Priority:** Medium (P2)  
**Status:** Backend done, frontend missing  
**Roadmap tier:** +1 (Hosted team workspaces)

### Problem
The server has full role logic (`owner` / `admin` / `member`) with invite and remove endpoints in `apps/server/src/routes/teams.ts`. The frontend has `CreateTeamModal.tsx` and `teamStore.ts` but no UI to list members, send invites, change roles, or remove members. The multi-user backend is invisible to users.

### What needs to be built
- **Team settings page / modal** — lists current members with their roles, with inline role picker for admins.
- **Invite flow** — email input + role selector → calls `POST /:teamId/members`. Show pending/accepted state.
- **Remove member** — confirm dialog → calls `DELETE /:teamId/members/:userId`. Owner-only.
- **Role badge** — surface the current user's role in `TopBar` or the team switcher so users know their permissions.

### Why it matters
Without this, team collaboration is invisible. It's the first screen a new team-plan customer opens, and its absence blocks any sales demo that involves more than one person.

### Entry points
- `apps/server/src/routes/teams.ts` — endpoints already exist
- `apps/web/src/teams/teamStore.ts` — add member fetch/invite/remove actions
- `apps/web/src/teams/CreateTeamModal.tsx` — can repurpose as a settings modal
- New `apps/web/src/teams/TeamSettingsModal.tsx`

---

## Quick Win — Prebuilt Scenarios & Default Environment

**Priority:** Low (P3) but fast to ship  
**Status:** Stubs only

`apps/web/src/scenarios/prebuilt.ts` exports an empty array. `apps/web/src/environments/defaults.ts` is `export {}`. Adding 2–3 prebuilt scenarios (e.g. a GitHub API flow, a REST CRUD example) and a sensible default environment would cut time-to-first-value for new users significantly, with minimal effort.

---

## Summary Table

| # | Feature | Status | Priority | Tier |
|---|---------|--------|----------|------|
| 1 | Bundle Signing + Registry | Not started | P0 | Now |
| 2 | OpenAPI → Blocks Importer | Not started | P1 | Next |
| 3 | Run History & Audit Logs | Not started | P1 | +1 |
| 4 | MCP Integration | Not started | P1 | +2 |
| 5 | Team Member Management UI | Backend done, UI missing | P2 | +1 |
| — | Prebuilt Scenarios | Stub | P3 | Quick win |
