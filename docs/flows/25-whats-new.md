# Flow 25 — What's New & Release Notes

## Summary
A user opens the What's New panel to view the latest product release notes and feature highlights.

## Actors
- Authenticated user

## Preconditions
- User is signed in

## Steps

### Happy Path
1. User opens the TopBar **More actions** menu.
2. User clicks **What's new**.
3. `WhatsNewPanel` opens in the right sidebar.
4. Panel shows a chronological list of release notes:
   - Version label
   - Date
   - List of changes with icons (feature, fix, improvement)
5. User scrolls through the notes.
6. User closes the panel.

## Edge Cases
- **No release notes** → empty state with "Check back soon" message.
- **Long release note text** → truncated with "Read more" expand.

## Related Flows
- [01-new-user-onboarding.md](./01-new-user-onboarding.md)
