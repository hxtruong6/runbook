# Flow 01 — New User Onboarding

## Summary
A brand-new user signs up, lands in the workspace, and completes the guided tour that auto-imports a sample bundle and runs their first block.

## Actors
- Unauthenticated visitor

## Preconditions
- No existing account
- No localStorage state

## Steps

### Happy Path
1. User navigates to the app root.
2. LoginPage is shown (`src/auth/LoginPage.tsx`).
3. User clicks **Create account** tab.
4. User fills in Email, Name, Password and clicks **Create account**.
5. Auth succeeds → token stored in `runbook:auth`.
6. App redirects to `AppContent`.
7. Tour detects first visit (no `rb_tour_loaded` key) and auto-imports the tour bundle.
8. `rb_tour_loaded` is set to `'1'`.
9. Tour banner appears at top of screen with Step 1 tip: "Pick an environment".
10. User selects an environment from the EnvSwitcher dropdown.
11. Banner advances to Step 2: "Click Run".
12. User clicks **Run all**.
13. First block executes; response renders in the block card.
14. Banner advances to Step 3: "View result / edit input".
15. User dismisses the banner.
16. `rb_tour_completed` and `rb_tour_banner_dismissed` are set to `'1'`.
17. `first_run_completed` telemetry event is emitted.

## Edge Cases
- **Duplicate email on register** → red alert below the form, stays on Create account tab.
- **Network error during signup** → red alert, button re-enabled.
- **Tour bundle fetch fails** → app still usable; banner does not appear.

## Key State
| Key | Value after flow |
|-----|-----------------|
| `runbook:auth` | JWT token |
| `rb_tour_loaded` | `'1'` |
| `rb_tour_completed` | `'1'` |
| `rb_tour_banner_dismissed` | `'1'` |

## Related Flows
- [02-api-testing-curl.md](./02-api-testing-curl.md)
- [05-environments.md](./05-environments.md)
