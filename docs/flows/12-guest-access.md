# Flow 12 — Guest Access & Sign-in Prompt

## Summary
An unauthenticated user accesses the app in guest mode (e.g. via a shared link), sees a sign-in banner, and can choose to sign up or log in.

## Actors
- Unauthenticated visitor

## Steps

### Happy Path — Guest Banner
1. User opens the app without a token (e.g. shared run-from-URL link).
2. App detects `isGuest = true` from `useAuthStore`.
3. `GuestBanner` renders at the top of the workspace.
4. Banner text: prompt to sign in or create an account.
5. User clicks **Sign in** → navigated to `LoginPage`.
6. User logs in → token stored; banner disappears.
7. App resumes from the page the guest was on.

### Happy Path — Sign-in Prompt after Guest Run
1. Guest visits `#/run?bundle=<url>&scenario=<id>`.
2. `RunFromUrl` page loads and imports the bundle.
3. User clicks **Import & run**.
4. Run executes in guest context.
5. After run, prompt appears to save work by signing up.
6. User clicks **Create account** → `LoginPage` (Create account tab).

## Edge Cases
- **Guest dismisses banner** → banner hidden for session; not persisted.
- **No token + no guest flag** → redirected to `LoginPage` immediately.

## Related Flows
- [01-new-user-onboarding.md](./01-new-user-onboarding.md)
- [10-gallery-run-from-url.md](./10-gallery-run-from-url.md)
