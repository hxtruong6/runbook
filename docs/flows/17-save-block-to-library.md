# Flow 17 — Save Block to Library from Scenario

## Summary
A user saves a configured block from a scenario into the block library so it can be reused across other scenarios.

## Actors
- Authenticated user

## Preconditions
- User is signed in
- A scenario with at least one configured block exists

## Steps

### Happy Path
1. User opens the **⋯** menu on a block card in the scenario.
2. User clicks **Save to library**.
3. A dialog/modal prompts for:
   - Block label (pre-filled from existing block label)
   - Tags (optional, comma-separated)
4. User confirms.
5. Block is saved to `runbook:local-blocks`.
6. Block library tab badge count increments.
7. User opens **Block Library** tab → new block appears in the list.

### Happy Path — Reuse in Another Scenario
1. User opens a different scenario.
2. User clicks **Add block** → scrolls to **My blocks** section.
3. User selects the saved block.
4. Block is added to the scenario with all its original overrides pre-filled.

## Edge Cases
- **Duplicate block kind** → user is warned; can overwrite or cancel.
- **Empty label** → validation error; save blocked.
- **Block with no configured values** → saved with empty overrides; works as a template.

## Related Flows
- [04-block-library.md](./04-block-library.md)
- [02-api-testing-curl.md](./02-api-testing-curl.md)
