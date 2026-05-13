# Block Editor & Runner — Postman-Style Params Redesign

**Date:** 2026-05-13
**Branch:** feat/graph-flow-designer
**Scope:** `src/blocks/types.ts`, `src/blocks/dataBlock.ts`, `src/blocks/urlTemplate.ts` (new), `src/components/BlockEditorModal.tsx`, `src/components/BlockForm.tsx`

---

## Goal

Replace the flat input list and split URL/query fields with a Postman-style interface where a single URL bar (including query string) drives auto-generated param sections. The runner shows inputs grouped by location (Path / Query / Body) with a live URL preview.

---

## Data Layer

### 1. `FieldSpec` — add `location` (`src/blocks/types.ts`)

```ts
export type FieldSpec = {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  fromContextKey?: string;
  enumValues?: readonly string[];
  placeholder?: string;
  location?: "path" | "query" | "body" | "header"; // NEW — optional for backward compat
};
```

Built-in hardcoded blocks (signin, profile, etc.) never set `location`; the runner falls back to a flat list for them.

### 2. `BlockDef` — add `urlTemplate?` (`src/blocks/types.ts`)

```ts
export type BlockDef = {
  kind: string;
  label: string;
  auth: AuthMode;
  inputs: FieldSpec[];
  outputs: OutputSpec[];
  urlTemplate?: string; // NEW — full URL template for live preview; only set for data-driven blocks
  build: (values: Record<string, unknown>) => HttpRequest;
};
```

### 3. `BlockDefData.request` — full URL replaces `urlTemplate` + `query` (`src/blocks/dataBlock.ts`)

**Before:**
```ts
request: {
  method: "POST",
  urlTemplate: "/v1/users/{{userId}}/photos",
  query: { socketSessionUuid: "{{socketSessionUuid}}" },
  bodyTemplate: { ... }
}
```

**After:**
```ts
request: {
  method: "POST",
  urlTemplate: "/v1/users/{{userId}}/photos?socketSessionUuid={{socketSessionUuid}}",
  bodyTemplate: { ... }
}
```

`query` is removed from the schema. `dataDefToBlockDef` handles migration: if `query` is present (old format), merge query entries into the URL string before processing.

The Zod `RequestSchema` keeps `query` as `.optional()` during migration, but new blocks never use it.

### 4. New: `src/blocks/urlTemplate.ts`

Pure utility functions, no React dependencies.

```ts
// Extract {{token}} names from the path portion (before ?)
export function parsePathTokens(urlTemplate: string): string[]

// Extract { key, token } pairs from ?key={{token}} in the query string
export function parseQueryEntries(urlTemplate: string): Array<{ key: string; token: string }>

// Extract {{token}} names from a bodyTemplate recursively (strings, arrays, objects)
export function parseBodyTokens(bodyTemplate: unknown): string[]

// Substitute values into URL template for live preview
// Unfilled tokens replaced with original {{token}} placeholder (caller highlights them)
export function previewUrl(urlTemplate: string, values: Record<string, unknown>): string
```

---

## Block Editor (`BlockEditorModal.tsx`)

### URL bar

One row: method SegmentedControl + full URL TextInput.

```
[POST ▾]  /v1/ortho-reviews/{{orthoReviewId}}/photos?socketSessionUuid={{socketSessionUuid}}
```

The separate "Query Params" K-V section is removed. Everything is in the URL bar.

### Auto-generated param sections

Derived live from URL parsing + body template parsing. Synced to `inputs` state on every URL / body template change.

**Sync logic:**
- New `{{token}}` appears in URL/body → add `InputDraft` (name = token, label = token, type = "string", location derived)
- Token removed → remove `InputDraft`
- Existing token → preserve label/type/fromContextKey, update location

#### Path Params section
Rendered for each `{{token}}` in the URL path (before `?`).

| Token (read-only) | Label | Type | From Context |
|---|---|---|---|
| `orthoReviewId` | [Ortho Review ID] | [string ▾] | [orthoReviewId] |

#### Query Params section
Rendered for each `?key={{token}}` pair in the URL query string.

| Key (read-only) | Token (read-only) | Label | Type | From Context |
|---|---|---|---|---|
| `socketSessionUuid` | `socketSessionUuid` | [Socket Session UUID] | [string ▾] | [socketSessionUuid] |

Note: to add a query param, the user types `?key={{token}}` directly in the URL bar.

#### Body Params section (POST/PUT only)
Rendered for each `{{token}}` found recursively in the body template JSON.

| Token (read-only) | Label | Type | From Context | Enum values (if enum) |
|---|---|---|---|---|
| `slot` | [Slot] | [enum ▾] | [] | [chairside-full-face, ...] |

The raw JSON body template textarea stays below the rows for direct editing.

### Headers section

Unchanged: manual K-V pairs.

### Outputs section

Unchanged.

### Save

`inputs` array built from the synced `InputDraft[]`. Each entry includes `location` derived from where the token was found:
- In URL path → `"path"`
- In URL query → `"query"`
- In body template → `"body"`

---

## Block Runner (`BlockForm.tsx`)

### URL preview bar

When `def.urlTemplate` is set, render a read-only URL preview at the top, above the input sections. Substitute current values (overrides + context) into the template. Tokens with no value yet are shown as `{tokenName}` with amber color.

```
POST  /v1/ortho-reviews/[orthoReviewId]/photos?socketSessionUuid=83c58a6a-...
                         ^amber if empty
```

### Grouped sections

When any `FieldSpec` has `location` set, group inputs into sections:
- **Path Params** — inputs with `location === "path"`
- **Query Params** — inputs with `location === "query"`
- **Body** — inputs with `location === "body"`
- **Headers** — inputs with `location === "header"` (rare)

Each section header is a small dimmed label (`Text size="xs" c="dimmed"`). Sections with no inputs are not rendered.

If no `FieldSpec` has `location` (built-in blocks), render the existing flat list — no sections, no URL preview.

---

## What is NOT changed

- Built-in hardcoded blocks (`signin.ts`, `profile.ts`, etc.) — no `location`, no `urlTemplate`, runner falls back to flat list
- `runScenario.ts` / `fetcher.ts` — no changes needed
- Auth handling
- Outputs capture logic
- `ResponseViewer.tsx`
- `BlockDefsPanel.tsx`

---

## Migration

Existing `BlockDefData` blocks in localStorage that use `request.query` will be handled by `dataDefToBlockDef`:

```ts
// In dataDefToBlockDef, before processing:
// If old query entries exist, append them to urlTemplate
if (data.request.query) {
  const queryStr = Object.entries(data.request.query)
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
  const sep = data.request.urlTemplate.includes("?") ? "&" : "?";
  data = { ...data, request: { ...data.request, urlTemplate: data.request.urlTemplate + sep + queryStr } };
}
```

No data migration script needed — old blocks continue to work, new blocks use the merged URL format.

---

## File Change Summary

| File | Change |
|---|---|
| `src/blocks/types.ts` | Add `location?` to `FieldSpec`; add `urlTemplate?` to `BlockDef` |
| `src/blocks/dataBlock.ts` | Remove `query` from schema (keep optional for migration); update `dataDefToBlockDef` to merge old query + set `urlTemplate` on returned `BlockDef` |
| `src/blocks/urlTemplate.ts` | New file: `parsePathTokens`, `parseQueryEntries`, `parseBodyTokens`, `previewUrl` |
| `src/components/BlockEditorModal.tsx` | Postman-style URL bar + auto-generated param sections; remove separate query K-V section |
| `src/components/BlockForm.tsx` | URL preview bar + grouped sections by `location`; flat fallback for built-in blocks |
| `tests/blocks/urlTemplate.test.ts` | New file: unit tests for all four utility functions |
