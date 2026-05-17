# Plan — Self-documenting bundles

**Goal:** Make every bundle carry its own documentation, generated from real
runs and from author-written markdown. After this lands, opening a shared
bundle should answer "what does this block do, what does it return, how do
I use this collection" without ever leaving Runbook.

This plan stitches together three threads:

1. **Persist** the existing schema-inference data into the bundle (today it
   lives in localStorage and is lost on export).
2. **Per-block markdown description** — author-written purpose, gotchas,
   examples.
3. **Per-collection (project + version) README** — onboarding text that
   renders when a user opens the bundle for the first time.

Together these turn a bundle into living documentation that travels with the
JSON file.

## Current state (verified 2026-05-18)

| Piece | Status |
|---|---|
| `inferSchema`, `mergeSchemas`, `detectDrift`, `captureFromResult` | ✅ shipped in `packages/shared/src/inference/` |
| `BlockInferenceSchema` field on `BlockDefDataSchema` | ✅ shipped (optional) |
| `captureRun` called from `App.tsx` + `BlockCard.tsx` after every run | ✅ shipped |
| `InferenceBanner`, `InferenceModal` UI | ✅ shipped |
| Persist inference into `bundle.blocks[].inference` on export | ❌ — store writes to localStorage only |
| Read inference from bundle on import / share view | ❌ |
| Per-block markdown description field | ❌ |
| Per-version / per-project README field | ❌ — only single-line `releaseNotes` exists |
| Markdown editor + renderer in UI | ❌ |

## File layout (new + changed)

```
packages/shared/src/
├─ runtime/
│  └─ bundle.ts                          CHANGE: add `description?: string` (markdown)
│                                                 to BlockDefDataSchema, ScenarioSchema
│                                                add `readme?: string` (markdown)
│                                                 to BundleVersionSchema
│
└─ inference/
   └─ bridge.ts                          NEW: pure helpers to copy localStorage
                                              inference → bundle.blocks[].inference
                                              and back on import

packages/shared/tests/
├─ runtime/
│  └─ bundle.schema.test.ts              CHANGE: cover new optional fields
└─ inference/
   └─ bridge.test.ts                     NEW: round-trip localStorage ↔ bundle

apps/web/src/
├─ inference/
│  └─ inferenceStore.ts                  CHANGE: expose
│                                              `seedFromBundle(bundle)`,
│                                              `mergeIntoBundle(bundle)` —
│                                              call the shared bridge
│
├─ projects/
│  └─ exportImport.ts                    CHANGE: on export, call
│                                              `mergeIntoBundle` so the JSON
│                                              file carries inference data
│                                              on import, call `seedFromBundle`
│                                              so the new workspace has it
│                                              from run one
│
├─ blocks/
│  ├─ BlockMarkdownEditor.tsx            NEW: markdown textarea + preview tabs
│  │                                            (reuse existing markdown
│  │                                            renderer used by release notes)
│  └─ BlockDescriptionPanel.tsx          NEW: read-only render in block detail
│
├─ components/
│  ├─ BlockCard.tsx                      CHANGE: show description excerpt
│                                                under label; full text in
│                                                expanded detail
│  └─ ScenarioCard.tsx                   CHANGE: same for scenarios
│
├─ projects/
│  └─ BundleReadmePanel.tsx              NEW: full-pane README viewer
│                                              rendered on first open of a
│                                              version, dismissible
│
└─ pages/
   └─ SharedRun.tsx                      CHANGE: surface block description +
                                                 inference example next to
                                                 the response viewer
```

## Schema changes

```ts
// BlockDefDataSchema
description: z.string().optional()              // markdown

// ScenarioSchema
description: z.string().optional()              // markdown

// BundleVersionSchema
readme: z.string().optional()                   // markdown, long-form
```

All optional — old bundles continue to load. No migration needed.

## Bridge: localStorage ↔ bundle

The existing inference store is keyed by **block kind** (string), so it
survives across projects that share kinds. Bridge rules:

- **On export**: for each block in the version, look up `getInferenceFor(kind)`
  in localStorage. If present, write into `block.inference`.
- **On import**: for each `block.inference` present in the bundle, seed
  localStorage with it (only if no local data exists for that kind, to
  avoid clobbering the user's richer local observations).
- **On share-link generation**: always embed inference. Shared view is
  read-only, so it's the only place a recipient sees the response shape.

## UX rules

### Markdown editors

- Use the existing markdown renderer already wired for release notes (do
  NOT add a new markdown lib).
- Editor: simple textarea + "Preview" tab. No WYSIWYG.
- Supports inline code, fenced code, links, headings, lists. Reject HTML.
- Block description: 1–2 paragraphs expected. No length limit, but show a
  "Long" badge above 500 chars and collapse to "Read more".

### Block detail layout

```
┌─ Block: createInvoice ───────────────────────────────┐
│ POST /v1/invoices                                    │
│                                                       │
│ ▾ Description (markdown)                              │
│   Creates an invoice in DRAFT state. Pass            │
│   `auto_advance: true` to finalize immediately.      │
│   See [Stripe docs](…) for line-item shape.          │
│                                                       │
│ ▾ Response shape (inferred from 12 runs)              │
│   ─ 2xx (10 runs) ──────────────────────────────────  │
│     { id: string (uuid), amount: integer, … }         │
│     Example: { "id": "in_xxx", "amount": 1200, … }    │
│   ─ 4xx (2 runs) ───────────────────────────────────  │
│     { error: { code: string, message: string } }      │
│                                                       │
│ ▸ Drift detected on last run (2026-05-15) — review   │
│                                                       │
│ [Inputs] [Run] [Edit]                                 │
└──────────────────────────────────────────────────────┘
```

### Bundle README

- Rendered as full-pane modal/overlay on first open of a project version
  (per browser, tracked in localStorage by `${projectId}:${version}`).
- Dismissible. "Open README" button always available in the project header.
- If empty/absent, no banner shown.

## Out of scope (v1)

- Inline images / asset attachments in markdown (link out instead).
- WYSIWYG editing.
- Diff of description across versions (the existing `changes[]` already
  covers "what changed"; description diffs are noise).
- AI-generated descriptions (covered separately under F9 in
  `growth-roadmap.md`).

## Implementation order (3 PRs)

1. **PR A — schema + bridge + tests** (~1 day)
   Add optional `description` / `readme` to schemas. Build the bridge in
   `packages/shared/src/inference/bridge.ts`. Wire export/import to use it.
   Pure shared work, no UI. Verify with round-trip test.

2. **PR B — markdown editing + viewing** (~2 days)
   Add `BlockMarkdownEditor`, `BlockDescriptionPanel`,
   `BundleReadmePanel`. Wire into block editor modal, scenario editor,
   project header. Reuse existing markdown renderer.

3. **PR C — inference-aware share view + drift surfacing** (~2 days)
   Update `SharedRun.tsx` to render inferred schema + example next to
   the actual response. Add the drift banner in block detail when
   `inference.lastDrift` is present.

## Acceptance criteria

- [ ] Exporting a bundle after a few runs produces a JSON file whose
      `blocks[].inference` contains schemas and examples.
- [ ] Importing that bundle into a fresh browser shows the inferred
      response shape in block detail with **zero runs** required.
- [ ] Editing a block description and re-exporting round-trips the
      markdown faithfully.
- [ ] Setting a version README and opening the project in incognito
      shows the README on first open and not again after dismiss.
- [ ] Shared-run page (`/s/:slug`) shows the block description and
      inferred response shape next to the actual run response.
- [ ] Old bundles (no `description`, no `readme`, no `inference`)
      continue to load without warnings.
- [ ] No new lint failures.
