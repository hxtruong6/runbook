# Plan — Hierarchical grouping & tag filter

**Goal:** Make the block list usable when a bundle has 200+ blocks (real-world
case: cworld-be has 42 controllers × multiple endpoints each). Today
`BlockDefsPanel` is flat and unscannable past ~30 blocks.

## Three building blocks

1. **Tags** — `tags?: string[]` on each block def. Imported automatically from
   OpenAPI `tags`, Postman folders, and the URL path prefix when neither is
   present.
2. **Groups** — a virtual tree built from tags + URL prefixes (e.g.
   `/admin/users/...` → admin › users). Tree is computed, not stored.
3. **Filter bar** — text search + tag chips above the list.

## File layout

```
packages/shared/src/
├─ runtime/
│  └─ bundle.ts                          CHANGE: add `tags?: string[]` to BlockDefDataSchema
│
├─ import/
│  ├─ openapi.ts                         CHANGE: copy spec.paths[*][method].tags into block.tags
│  └─ postman.ts                         CHANGE: derive tags from folder hierarchy
│
└─ blocks/                               NEW
   └─ grouping.ts                        groupBlocks(blocks, mode): build the tree from tags + URLs

packages/shared/tests/
└─ blocks/
   └─ grouping.test.ts                   Coverage: tag-only, path-only, mixed, empty

apps/web/src/
├─ components/
│  ├─ BlockDefsPanel.tsx                 REWRITE: replace flat list with TreeView
│  │                                              persistent expanded state in localStorage
│  │
│  ├─ BlockFilterBar.tsx                 NEW: text input + active-tag chips + clear-all
│  └─ BlockTreeNode.tsx                  NEW: recursive renderer (group node / leaf node)
│
├─ features/
│  └─ blocks/
│     ├─ useBlockFilter.ts               NEW: hook owning query string + selected tags
│     └─ blockGrouping.ts                NEW: thin wrapper around shared groupBlocks for UI
│
└─ stores/
   └─ uiStore.ts                         CHANGE: persist `groupingMode: 'tag' | 'path' | 'flat'`
                                                 and `expandedGroups: string[]`
```

## UX rules

- Default grouping mode = **'tag'** if any block has tags, else **'path'**, else
  **'flat'**.
- Top-level group order: alphabetical, except untagged blocks sink to bottom
  under group label "(uncategorized)".
- Filter bar text input does **substring match** on label + URL template + tag.
  Case-insensitive. Matching is OR across these three fields.
- Selected tag chips AND together. Click a tag in a block → that tag becomes
  selected.
- Empty state when filter yields nothing: shows "No blocks match", with a
  "Clear filter" button. (Reuse the existing `EmptyState` component.)
- Mobile (<768px): tree collapses to a single dropdown. Don't try to fit a
  tree on a 360px screen.

## Tagging from imports (no user effort required)

- **OpenAPI**: `spec.paths['/admin/users/{id}'].get.tags = ['admin', 'users']`
  → block.tags = ['admin', 'users']. Always include the first path segment as a
  fallback tag.
- **Postman**: folder path `Admin > Users > Create` → tags = ['Admin', 'Users'].
- **curl paste**: derive a single tag from the host (`api.staging.foo.com` →
  'foo'). Cheap heuristic.
- **Manual**: block editor gains a "Tags" multi-select with autocomplete from
  existing bundle tags.

## Settings

Add to bundle settings panel:

- Grouping mode dropdown (Tag / Path / Flat)
- "Show counts on group labels" toggle (default On)

## Performance

200 blocks × tree expand/collapse: trivial. No virtualization needed at this
scale. If we hit 2000 blocks (unlikely), switch to react-window inside
`BlockTreeNode`.

## Implementation order (2 PRs)

1. **PR A — tagging + shared grouping + tests** (~1 day)
   Add tags to bundle schema. Update importers. Write `groupBlocks`. Don't
   touch the UI yet — verify shape via tests.

2. **PR B — web app: tree view + filter bar** (~2 days)
   Replace `BlockDefsPanel` flat list with tree. Add filter bar above. Wire
   localStorage persistence for expanded state.

## Acceptance criteria

- [ ] Importing the cworld-be OpenAPI yields blocks grouped under `admin`,
      `webhook`, `auth`, etc., automatically.
- [ ] Filter bar narrows the visible tree in <100ms for 200 blocks.
- [ ] Switching grouping mode preserves user's filter state.
- [ ] Existing scenario blocks still link to the right block defs (no
      regression in block reference resolution).
- [ ] Mobile layout works on 360px wide screen.
