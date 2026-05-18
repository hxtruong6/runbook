# Flow 08 — Burst Runner

## Summary
A user configures and launches a burst run (multiple parallel or sequential executions of a scenario), monitors progress, then inspects results.

## Actors
- Authenticated user

## Preconditions
- User is signed in
- An active scenario with at least one block exists

## Steps

### Happy Path
1. User opens the TopBar **More actions** menu.
2. User clicks **Burst runner**.
3. `BurstDrawer` opens on the right side.
4. User configures:
   - **Count**: 10
   - **Window (ms)**: 1000
   - **Concurrency**: Parallel
   - **Fresh context**: enabled
5. User clicks **Run**.
6. Progress bars appear for each run (pending → running → ok/error).
7. Timeline visualization renders live as runs complete.
8. All 10 runs complete; summary shows total, pass count, fail count.
9. User clicks an individual run row → drill-down shows block-level results.
10. User closes the drawer.

### Happy Path — Abort
1. User starts a burst run with 20 runs.
2. After 5 runs complete, user clicks **Abort**.
3. Remaining runs are cancelled; results for completed runs are preserved.

## Edge Cases
- **All runs fail** → summary shows 0/10 passed; individual drill-downs show error details.
- **No scenario selected** → Burst runner menu item is disabled.
- **Count = 1** → single run executes; same results view applies.
- **Sequential concurrency** → runs execute one at a time; timeline shows serial progression.

## Related Flows
- [02-api-testing-curl.md](./02-api-testing-curl.md)
- [15-block-assertions.md](./15-block-assertions.md)
