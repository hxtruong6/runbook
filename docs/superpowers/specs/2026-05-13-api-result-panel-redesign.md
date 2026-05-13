# API Result Panel Redesign

**Date:** 2026-05-13
**Branch:** feat/graph-flow-designer
**Scope:** `ResponseViewer.tsx`, `fetcher.ts`, `runScenario.ts`, `blocks/types.ts`

---

## Goal

After a block runs (success or failure), the result panel must provide:

1. A clear at-a-glance status bar (code, timing, endpoint, error/captured summary)
2. Tabs: Response body · full Request · copyable Code snippets
3. A one-click "copy request+response" for team sharing
4. Auth tokens: always redacted in the UI, real value when copied

---

## Data Layer

### 1. `RunRequestResult` (fetcher.ts)

Add `resolvedRequest` to carry the final resolved HTTP details (with auth headers merged in):

```ts
export type RunRequestResult = {
  httpStatus: number;
  body: unknown;
  elapsedMs: number;
  resolvedRequest: {
    method: string;
    url: string;
    headers: Record<string, string>;
    body?: unknown;
  };
};
```

`runRequest` already builds the final `headers` object and `url` before calling `fetch`. Return them as `resolvedRequest` alongside `httpStatus` / `body`.

### 2. `BlockRunResult` (blocks/types.ts)

Add an optional `request` field to both branches of the union:

```ts
type ResolvedRequest = {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: unknown;
};

export type BlockRunResult =
  | { status: "ok";  httpStatus: number; elapsedMs: number; response: unknown; captured: Record<string, unknown>; request?: ResolvedRequest; subResults?: BlockRunResult[] }
  | { status: "err"; httpStatus?: number; elapsedMs: number; response: unknown; error: string; request?: ResolvedRequest; subResults?: BlockRunResult[] };
```

### 3. `runBlock` (runScenario.ts)

After `runRequest` resolves, propagate `resolvedRequest` into the returned `BlockRunResult`:

```ts
const { httpStatus, body, elapsedMs, resolvedRequest } = await runRequest(req, { ... });
// include resolvedRequest in both ok and err branches
```

---

## UI — `ResponseViewer.tsx`

The component is restructured into four focused sub-components, all in the same file.

### `ResultStatusBar`

Renders the colored header row immediately after a run. Never shown when `result` is null.

```
✕  HTTP 500  ·  562ms  ·  GET /api/ortho-reviews/gjg
   Internal server error

✓  HTTP 200  ·  234ms  ·  GET /api/ortho-reviews/abc
   Captured: orthoReviewId, syncToken
```

- Color: `red` for `err`, `teal` for `ok` — uses Mantine `Alert` with `variant="light"`
- Icon: `IconX` (err) / `IconCheck` (ok) from `@tabler/icons-react`, size 16
- Error line: `result.error` text, shown only on `err`
- Captured line: comma-separated keys from `Object.keys(result.captured)`, shown only on `ok` when at least one key exists

### Tabs

Below the status bar, a `Tabs` component with three panels and a "Copy request+response" button pinned to the right of the tab list.

```
[Response]  [Request]  [Code]           [Copy request+response ↗]
─────────────────────────────────────────────────────────────────
<panel content>
```

Default active tab: `Response`.

#### Response tab

Unchanged from current implementation: `ScrollArea` + `Code block` showing JSON (or raw string) of `result.response`.

#### Request tab

Shows the resolved request (from `result.request`). If `result.request` is absent (socket blocks, sub-results), renders a dimmed "Request details not available" message.

Layout:
- Method badge + full URL on one line
- Headers table: two-column (name / value). Any header whose name is `Authorization` or `Cookie` has its value replaced with `••••••••` in the display. All other headers shown as-is.
- Body: JSON code block, shown only if body is present.

#### Code tab

A `SegmentedControl` with three options: `curl` · `Node fetch` · `Axios`. One snippet shown at a time. A `[Copy ↗]` button in the top-right of the panel copies the real (unredacted) snippet to clipboard.

Display rendering: any occurrence of a real token string is replaced with `YOUR_TOKEN` in the displayed code.

**curl template:**
```
curl -X {METHOD} '{URL}' \
  -H 'Authorization: YOUR_TOKEN' \
  -H 'Content-Type: application/json' \
  --data '{body}'
```

**Node fetch template:**
```js
const res = await fetch('{URL}', {
  method: '{METHOD}',
  headers: {
    'Authorization': 'YOUR_TOKEN',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({body}),
});
const data = await res.json();
```

**Axios template:**
```js
const { data } = await axios.{method}('{URL}', {body}, {
  headers: {
    'Authorization': 'YOUR_TOKEN',
    'Content-Type': 'application/json',
  },
});
```

For GET requests with no body, the `body` / `--data` parts are omitted.

### `CopyAllButton`

Copies the following plain-text format to clipboard (with real token values):

```
=== REQUEST ===
{METHOD} {URL}
{Header-Name}: {real value}
...

{body as JSON}

=== RESPONSE ===
HTTP {httpStatus}  ({elapsedMs}ms)
{response as JSON}
```

---

## Redaction Rules

| Location | Token display | Clipboard value |
|---|---|---|
| Request tab headers | `••••••••` | real value |
| Code tab snippet | `YOUR_TOKEN` | real value |
| Copy request+response | — | real value |

Headers considered sensitive: `Authorization`, `Cookie`, `X-Api-Key`, `X-Auth-Token`.

---

## What is NOT changed

- `BlockCard.tsx` — no changes needed; it already passes `result` to `ResponseViewer`
- Socket blocks — `ResponseViewer` is not used for socket blocks; no impact
- `runScenarioFrom` / `runOneBlock` — sub-results do not need `request` propagated (it is optional)
- Existing `BlockRunResult` consumers (`BurstResultsSummary`, `ScenarioRefCard`) — `request` is optional so no breakage

---

## File Change Summary

| File | Change |
|---|---|
| `src/api/fetcher.ts` | Add `resolvedRequest` to `RunRequestResult`; return it from `runRequest` |
| `src/blocks/types.ts` | Add `ResolvedRequest` type; add optional `request` field to `BlockRunResult` |
| `src/execution/runScenario.ts` | Propagate `resolvedRequest` → `request` in `runBlock` |
| `src/components/ResponseViewer.tsx` | Full redesign: `ResultStatusBar`, `ResponseTab`, `RequestTab`, `CodeTab`, `CopyAllButton` |
