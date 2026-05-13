# Backend Design — Runbook

**Date:** 2026-05-13  
**Status:** Approved

## Overview

Add a TypeScript backend to Runbook to support multi-team workspaces, durable server-side persistence, and real-time collaborative editing of scenarios.

---

## Repository Structure

Monorepo with three packages managed via pnpm workspaces:

```
runbook/
├── apps/
│   ├── web/          # existing frontend (moved here)
│   └── server/       # new Fastify backend
└── packages/
    └── shared/       # Zod schemas and TypeScript types shared by both apps
```

`packages/shared` is the single source of truth for all domain schemas. Both `apps/web` and `apps/server` import from it. No schema is defined twice.

---

## Stack

| Concern | Choice | Reason |
|---|---|---|
| Language | TypeScript | End-to-end type safety; shared schemas with frontend |
| Framework | Fastify | Lightweight, TypeScript-native, no decorator magic |
| Database | MongoDB (native driver) | JSON-document fit; no schema duplication vs Mongoose |
| Validation | Zod (from `packages/shared`) | Already used in frontend; reused on server |
| Real-time | Socket.io | Already wired in frontend (`src/api/socket.ts`) |
| Auth | JWT (stateless) | Simple, no session table needed |
| Migrations | migrate-mongo | Purpose-built for MongoDB, tracks applied migrations |

---

## Data Model

Five MongoDB collections:

```
users
  _id, email, name, passwordHash, createdAt

teams
  _id, name, slug, createdAt

memberships
  _id, userId, teamId, role: "owner" | "admin" | "member"

projects
  _id, teamId, name, versions: ProjectVersion[]

scenarios
  _id, projectId, teamId, name, blocks, graphData, updatedAt, updatedBy
```

**Key decisions:**

- `scenarios` are top-level documents, not embedded in `projects`. Real-time updates patch one document and broadcast one event — no full-project rewrites on every edit.
- `projects.versions[]` holds published bundle snapshots (the existing versioning model). Active scenarios live separately and are snapshotted into a version on publish.
- `teamId` is denormalized onto `scenarios` for cheap access control checks without joins.
- **Environments stay client-side.** They contain secrets (tokens, passwords). Only `name` and `baseUrl` are stored server-side if needed for display; auth config never leaves the browser.

---

## API

### REST (Fastify)

```
POST   /auth/register
POST   /auth/login
POST   /auth/logout

GET    /teams
POST   /teams
GET    /teams/:teamId/members
POST   /teams/:teamId/members
DELETE /teams/:teamId/members/:userId

GET    /teams/:teamId/projects
POST   /teams/:teamId/projects
GET    /teams/:teamId/projects/:projectId
DELETE /teams/:teamId/projects/:projectId

GET    /teams/:teamId/scenarios
POST   /teams/:teamId/scenarios
GET    /teams/:teamId/scenarios/:scenarioId
PATCH  /teams/:teamId/scenarios/:scenarioId
DELETE /teams/:teamId/scenarios/:scenarioId
```

### Socket.io Events

```
# Client → Server
join_project    { projectId }
leave_project   { projectId }
patch_scenario  { scenarioId, patch }   # JSON patch (RFC 6902)

# Server → Client
presence        { users: [{ id, name, scenarioId }] }
scenario_patch  { scenarioId, patch, updatedBy }
scenario_saved  { scenarioId, updatedAt }
```

Conflict resolution is last-write-wins per field. No OT or CRDT — appropriate for this use case.

---

## Auth

- Register and login return a signed JWT (7-day expiry).
- Client stores JWT in `localStorage`, sends as `Authorization: Bearer <token>`.
- Socket.io receives JWT in handshake query (`?token=...`).
- Protected routes use a single `authenticate` preHandler function — no framework DI or decorators.
- No OAuth or refresh token rotation in v1.

---

## Migrations

Tool: **migrate-mongo**

```
apps/server/
├── migrations/
│   ├── 20260513_001_init_indexes.ts
│   ├── 20260513_002_seed_roles.ts
│   └── ...
└── migrate-mongo-config.ts
```

Each file exports `up(db)` and `down(db)`. Applied migrations are tracked in a `_migrations` collection.

```bash
pnpm migrate:up       # apply all pending
pnpm migrate:down     # roll back last
pnpm migrate:status   # list applied/pending
pnpm migrate:create   # scaffold new file
```

First migration: create indexes on `scenarios.teamId`, `scenarios.projectId`, `memberships.userId`, `memberships.teamId`.

---

## What's Out of Scope (v1)

- OAuth / social login
- Refresh token rotation
- Environments stored server-side with encryption
- Offline support / CRDT sync
- Billing or usage limits per team
