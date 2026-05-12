# Chairside API Workflow Runner — Design

**Date:** 2026-05-12
**Status:** Approved (design); pending implementation plan
**Author:** xuantruong

## Problem

End-to-end testing of the 32CO chairside flow requires exercising a chain of API calls (auth → profile → device-token verify → start review → photo uploads → status update) and Socket.IO events. Running a full E2E test framework for each scenario tweak is slow. We need a lightweight, browser-based tool where each API call is a discrete "block" the user can run individually or as a chain, with values automatically threaded between calls.

## Goals

- Each chairside endpoint (§1–§9 from the handover) is a prebuilt, typed block.
- Scenarios are composed by arranging blocks; saved locally; exportable/importable as JSON to share with teammates.
- Values produced by one block (e.g. `syncToken`, `orthoReviewId`) auto-populate inputs of later blocks via a shared context, with a live, editable context panel.
- Each block can be run individually; the scenario can also "run all" or "run from here", stopping on first non-2xx.
- Auth supports both: running a `signin` block (sets JWT cookie + captures bearer) **or** pasting a JWT into the context panel.

## Non-goals (v1)

- S3 photo upload helper. §6 takes a literal `url` string for now.
- Assertions / pass-fail beyond HTTP status code.
- Backend persistence or multi-user sharing beyond exported JSON files.
- Parallel scenarios — exactly one active scenario at a time.
- Authentication for the tool itself; runs locally only.

## Architecture

Single-page Vite + React + TS app, no backend. Three panels:

- **Left — Scenario list.** All saved scenarios from localStorage. Buttons: New, Duplicate, Delete, Export JSON, Import JSON. Ships with three prebuilt scenarios (see Scenarios below).
- **Center — Block list.** Ordered blocks of the active scenario. Each block renders as a card with a status badge, run button, collapsible request editor, and response viewer.
- **Right — Context panel.** Live key/value table of captured variables. Editable inline (so user can paste a JWT or override a captured value).

Top bar: scenario name (editable), **Run all**, **Run from here**, **Reset context**, **Export**, **Import**.

### Block model

A block is a typed config keyed by `kind`, not free-form HTTP. Each kind declares:

- `kind: string` — discriminator
- `label: string` — display name (e.g. "§5 Start chairside")
- `inputs: FieldSpec[]` — typed fields with name, type, `fromContextKey?` (auto-fill from context)
- `outputs: OutputSpec[]` — JSONPath → context key mapping (what to capture)
- `auth: 'none' | 'jwt' | 'cookie-or-jwt'`
- `request(inputs): { method, url, headers, body }` — builds the HTTP call
- For `socket` kinds: `connect(inputs): SocketHandle` instead of `request`

Block kinds in v1:

| Kind | Maps to | Inputs (literal or from context) | Captures to context |
| --- | --- | --- | --- |
| `signin` | `POST /v1/user/auth/signin` | `email`, `password` | `jwt`, `userId`, full profile |
| `profile` | §1 `GET /v1/user/auth/profile` | (jwt) | `orthoReviewChairsideToken`, `isChairsideEnabled` |
| `featureHighlightsGet` | §2 | (jwt) | `showChairsideInstallBanner` |
| `featureHighlightsDismiss` | §3 | (jwt) | — |
| `verifyDeviceToken` | §4 | `orthoReviewChairsideToken` | `user`, `practices[0].id` → `practiceId`, `corporate` |
| `startChairside` | §5 | `firstName`, `lastName`, `practiceId`, `orthoReviewChairsideToken` | `syncToken`, `orthoReviewId` |
| `uploadPhoto` | §6 | `orthoReviewId`, `syncToken`, `slot`, `url`, `socketSessionUuid?` | — |
| `getOrthoReview` | §7 | `orthoReviewId` (jwt) | full review JSON → `orthoReview` |
| `updateChairsideStatus` | §8 | `orthoReviewId`, `syncToken`, `chairsideStatus` | `chairsideStatus` |
| `socketConnect` | §9 | `userId`, `role`, `orthoReviewId` | latest event payload → `lastSocketEvent` |

Each block renders an editable form derived from its `inputs` spec — not a generic JSON editor. A field whose value comes from context shows a small chip "← context: `syncToken`" and is editable to override.

### Context

A single flat object stored in React state for the active run, e.g.

```ts
type Context = {
  jwt?: string;
  userId?: string;
  orthoReviewChairsideToken?: string;
  practiceId?: string;
  syncToken?: string;
  orthoReviewId?: string;
  socketSessionUuid: string;          // auto-generated on session start
  chairsideStatus?: 'IN_PROGRESS' | 'COMPLETED' | 'ARCHIVED';
  lastSocketEvent?: unknown;
  [k: string]: unknown;
};
```

Rules:

- After a block runs successfully, its declared outputs are merged in (overwriting prior values for the same keys).
- Before a block runs, each input reads from context if `fromContextKey` is set and not overridden.
- **Reset context** clears everything and regenerates `socketSessionUuid` via `crypto.randomUUID()`.
- Context is **not** persisted across page reloads. Only scenario definitions are. (Tokens stay in memory.)
- The Context panel is the source of truth — users can edit any value inline, which immediately affects the next block to run.

### Auth handling

- `cookie-or-jwt` blocks (§1, §2, §3, §7): if `context.jwt` is set, send `Authorization: Bearer <jwt>`; otherwise rely on the `consumer_token` cookie set by a prior `signin` block (`credentials: 'include'`).
- `signin` block captures `jwt` from the response body into context, so subsequent blocks default to bearer auth. The cookie path is the fallback when user clears `jwt`.
- All `fetch` calls use `credentials: 'include'`.

### Execution

- **Per-block Run**: runs that block only, updates context on success.
- **Run all**: iterates blocks top-to-bottom, stops on first block whose response is non-2xx (or `socket` block error). Socket blocks already-connected from a prior run are treated as success no-ops.
- **Run from here**: same as Run all, but starts from the selected block.
- Each block shows: status badge (idle / running / ok / err), HTTP status code, elapsed ms, request preview (method + URL + headers + body, redacting `password`), response viewer (pretty JSON + raw toggle).

### Socket block

- Opens a `socket.io-client` connection to `API_BASE_URL` with `path: '/chat'`, query `{ userId, role: 'DENTIST' }`, `withCredentials: true`, `transports: ['websocket', 'polling']`.
- On connect, emits `join_chairside_session` with `{ sessionId: orthoReviewId }`.
- Listens for `chairside_session_update`, logging each event into the block's event log and updating `context.lastSocketEvent`.
- Filters out events whose `socketSessionUuid === context.socketSessionUuid` (echo suppression per the handover).
- Has its own Disconnect button. Disconnected on Reset context, scenario switch, or page unload.

### Scenario persistence

- localStorage key `chairside-runner:scenarios` → `Scenario[]`
- `Scenario = { id, name, createdAt, blocks: Block[] }`
- Block stores its `kind`, label, and any user-overridden literal field values. Auto-from-context fields store no value.
- Export: serialize active scenario → download as `<name>.scenario.json`.
- Import: parse uploaded JSON, validate shape (zod), add to list.
- Prebuilt scenarios shipped in code, copied to localStorage on first run:
  - **Chairside happy path**: signin → profile → startChairside → uploadPhoto×4 (one per slot, literal URL placeholder) → getOrthoReview → updateChairsideStatus(COMPLETED)
  - **Phone first-pair**: verifyDeviceToken
  - **Dismiss install banner**: signin → featureHighlightsGet → featureHighlightsDismiss
  - **Realtime sanity**: signin → startChairside → socketConnect → uploadPhoto → updateChairsideStatus(COMPLETED)

### Configuration

- API base URL is a single constant `API_BASE_URL` read from `import.meta.env.VITE_API_BASE_URL`, defaulting to `https://api-truong.32co.com`.
- Socket path is fixed at `/chat` per the handover.

## File layout

```
src/
  api/
    fetcher.ts          # wraps fetch: base URL, auth header injection, JSON parse, timing
    socket.ts           # wraps socket.io-client lifecycle
  blocks/
    index.ts            # block registry (kind → BlockDef)
    types.ts            # BlockDef, FieldSpec, OutputSpec, Block (instance)
    signin.ts
    profile.ts
    featureHighlights.ts # exports both Get + Dismiss defs
    verifyDeviceToken.ts
    startChairside.ts
    uploadPhoto.ts
    getOrthoReview.ts
    updateChairsideStatus.ts
    socketConnect.ts
  context/
    ContextStore.tsx    # React context + reducer for runtime context object
  scenarios/
    storage.ts          # localStorage CRUD + zod validation
    prebuilt.ts         # the four shipped scenarios
    exportImport.ts     # download/upload JSON
  components/
    TopBar.tsx
    ScenarioList.tsx
    BlockList.tsx
    BlockCard.tsx       # generic shell; delegates form to schema
    BlockForm.tsx       # renders FieldSpec[] with "← context" chips
    ResponseViewer.tsx
    SocketEventLog.tsx
    ContextPanel.tsx
  App.tsx
  main.tsx
  index.css
```

Each `blocks/<kind>.ts` is small and self-contained: it exports a single `BlockDef` describing the endpoint, fields, and capture map. Adding a new endpoint = one new file + one entry in `blocks/index.ts`.

## Error handling

- Network / fetch failures: block status = `err`, response viewer shows the error message.
- Non-2xx: block status = `err`, response viewer shows the JSON body and status code.
- Socket disconnect: block shows "disconnected" badge, log retains prior events.
- "Run all" early-stops on first `err`. The failing block is scrolled into view.
- JSON-parse failure on response: viewer falls back to raw text.

## Testing

Vitest unit tests (no Playwright in v1 — this app *is* the manual E2E tool):

- `blocks/*` — for each block: request builder produces correct URL/headers/body given an input set; output capture extracts the right keys from a sample response.
- `context/ContextStore` — merge semantics, reset clears all except regenerated `socketSessionUuid`.
- `scenarios/storage` — load/save round-trip; invalid imports are rejected.
- `scenarios/exportImport` — export → import round-trip preserves block configs.
- `api/fetcher` — auth header injection picks `Bearer` when `jwt` is set, omits when not.

Manual testing in browser against the live `32co-alpha` env using the test account in the handover.

## Out of scope (future)

- S3 photo upload block (signed URL + PUT + auto-capture URL).
- Per-block assertions ("expect 200", "expect `chairsideStatus === COMPLETED`").
- Backend service for shared scenarios across machines.
- Recording mode that captures a real browser session into a scenario.
- Run history / replay diff.
