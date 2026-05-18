# Flow 23 — Run History & Diff

## Summary
A user runs a scenario multiple times, opens the run history panel, and compares two runs side-by-side to spot response changes.

## Actors
- Authenticated user

## Preconditions
- User is signed in
- A scenario has been run at least twice

## Steps

### Happy Path — View Run History
1. User opens the **Context** right sidebar tab.
2. User switches to the **History** tab (or opens the `RunHistoryPanel`).
3. Panel shows a list of past runs for the active scenario:
   - Timestamp
   - Overall status (ok/error)
   - Block count + pass/fail count
4. User clicks a run row → block-level details expand inline.

### Happy Path — Compare Runs (RunDiff)
1. User selects two runs from the history list using checkboxes.
2. User clicks **Compare**.
3. `RunDiff` component renders side-by-side:
   - Left: older run
   - Right: newer run
   - Diffed fields highlighted (status changes, response body changes, timing)
4. Changed values shown in amber; added/removed lines in green/red.

## Edge Cases
- **Only one run** → Compare button disabled.
- **Runs from different scenarios** → cannot compare; UI prevents cross-scenario selection.
- **Very large response bodies** → diff truncated with "Show more" button.
- **No run history** → "No runs yet" empty state in panel.

## Related Flows
- [02-api-testing-curl.md](./02-api-testing-curl.md)
- [08-burst-runner.md](./08-burst-runner.md)
