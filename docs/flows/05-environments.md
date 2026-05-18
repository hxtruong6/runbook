# Flow 05 — Environment & Auth Configuration

## Summary
A user creates environments with different auth configurations, switches between them, and verifies that auth headers are applied to block runs.

## Actors
- Authenticated user

## Preconditions
- User is signed in

## Steps

### Happy Path — Create Environment
1. User clicks the **Environment** dropdown in the TopBar.
2. User selects **Manage…** → `EnvEditorModal` opens.
3. User clicks **+ Add environment**.
4. User fills in:
   - Name: "Production"
   - Base URL: "https://api.example.com"
   - Auth kind: **Bearer**
   - Token: "my-secret-token"
5. User clicks **Save**.
6. New environment appears in the modal list with a blue **Bearer** badge.
7. User closes the modal.

### Happy Path — Switch Environment
1. User opens the Environment dropdown in the TopBar.
2. User selects "Production".
3. TopBar shows the active environment name.
4. All subsequent block runs use "Production" base URL and bearer token.

### Happy Path — Auth Kinds
| Kind | Badge color | Fields |
|------|-------------|--------|
| None | gray | — |
| Bearer | blue | Token |
| Cookie | teal | Cookie name + value |
| API Key | grape | Header name + value |
| Basic | amber | Username + password |

### Happy Path — Edit / Delete
1. User opens **Manage…** → selects environment → edits fields → saves.
2. User deletes environment → confirm → removed from list.

## Edge Cases
- **No environments** → dropdown shows "No environments" + Add CTA.
- **Duplicate environment name** → validation error in modal.
- **Delete active environment** → app falls back to "No environment".

## Key State
- Environments persisted in `runbook:environments`.
- Active environment ID persisted across reloads.

## Related Flows
- [01-new-user-onboarding.md](./01-new-user-onboarding.md)
- [02-api-testing-curl.md](./02-api-testing-curl.md)
