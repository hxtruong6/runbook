# Flow 11 — Password Reset

## Summary
An existing user who has forgotten their password requests a reset email, follows the link, and sets a new password.

## Actors
- Unauthenticated user with an existing account

## Steps

### Happy Path
1. User is on `LoginPage` (Sign in tab).
2. User clicks **Forgot password?**.
3. `ForgotPasswordModal` opens with an email input.
4. User enters their registered email and clicks **Send reset link**.
5. Success message: "Check your email for a reset link."
6. Modal closes.
7. User opens email and clicks the reset link → navigated to `#/reset-password?token=<token>`.
8. `ResetPasswordPage` renders with a new-password form.
9. User enters a new password and confirms it.
10. User clicks **Reset password**.
11. Success message shown; user auto-redirected to `LoginPage`.
12. User signs in with the new password successfully.

## Edge Cases
- **Unknown email** → error alert: "No account found for this email."
- **Expired reset token** → error: "This link has expired. Request a new one."
- **Passwords do not match** → inline validation error; button stays disabled.
- **Password too short** → inline validation error.
- **Token already used** → error alert on `ResetPasswordPage`.

## Related Flows
- [01-new-user-onboarding.md](./01-new-user-onboarding.md)
- [12-guest-access.md](./12-guest-access.md)
