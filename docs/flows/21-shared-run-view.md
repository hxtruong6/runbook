# Flow 21 — Shared Run View

## Summary
A user views a read-only page showing the results of a previously shared scenario run, without needing to be authenticated.

## Actors
- Any user (authenticated or not) with the shared run URL

## Preconditions
- A run has been shared via the Share run button (Flow 20)
- The share URL is valid and not expired

## Steps

### Happy Path
1. User opens the shared run URL (e.g. `#/runs/<runId>`).
2. `SharedRun` page loads.
3. Page shows:
   - Scenario name and project name
   - Run timestamp
   - Each block card in read-only mode showing:
     - Status badge (ok/error)
     - HTTP status + elapsed time
     - Response body
     - Assertion results (pass/fail)
4. No edit controls are shown.
5. **Open in Runbook** button is available.
6. User clicks **Open in Runbook** → bundle imported; scenario opened in workspace.

## Edge Cases
- **Run not found** → 404 error state with "Run not found" message and back button.
- **Run expired** → error state explaining expiry.
- **Large response body** → response viewer is collapsed by default; expand button available.
- **Failed run** → error details shown for each failed block.

## Related Flows
- [20-bundle-publish-embed.md](./20-bundle-publish-embed.md)
- [10-gallery-run-from-url.md](./10-gallery-run-from-url.md)
