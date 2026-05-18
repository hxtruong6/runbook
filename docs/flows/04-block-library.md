# Flow 04 — Block Library Management

## Summary
A user builds up the block library by adding blocks via cURL paste and OpenAPI import, then searches, groups, and filters them. State persists across reloads.

## Actors
- Authenticated user

## Preconditions
- User is signed in

## Steps

### Happy Path — Add via cURL
1. User opens the **Block Library** tab in the sidebar.
2. User clicks **+** → **Paste cURL**.
3. Pastes a cURL command and clicks **Add block**.
4. Block appears in the library list.

### Happy Path — Search & Filter
1. User types in the **Filter blocks** search input.
2. Block list filters in real-time; "Showing X of Y" count updates.
3. User clicks a **tag chip** to filter by tag (AND semantics).
4. Only blocks matching both text and tag remain.
5. User clicks **Clear filters** → full list restored.

### Happy Path — Grouping
1. User opens the **Group by** dropdown.
2. Selects **By tag** → blocks are grouped under collapsible tag headers.
3. User collapses a group by clicking the header.
4. User reloads the page → collapsed state is preserved.
5. User selects **Flat** → all blocks shown in a flat list.

### Happy Path — Delete Block
1. User hovers over a block → **⋯** menu appears.
2. User clicks **Delete** → confirm dialog.
3. User confirms → block removed from library and `runbook:local-blocks`.

## Edge Cases
- **No blocks in library** → "No API blocks yet" empty state with onboarding CTAs.
- **Filter returns no matches** → "No blocks match filter" + Clear filters CTA.
- **Library with 100+ blocks** → grouping and search still performant.
- **Reload preserves** grouping mode, expanded/collapsed groups, and block list.

## Key State
| Key | Value |
|-----|-------|
| `runbook:local-blocks` | `BlockDefData[]` array |
| `runbook:block-ui` | `{ groupingMode, expandedGroups }` |

## Related Flows
- [02-api-testing-curl.md](./02-api-testing-curl.md)
- [17-save-block-to-library.md](./17-save-block-to-library.md)
