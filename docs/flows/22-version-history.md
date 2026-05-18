# Flow 22 — Project Version History

## Summary
A user views the version history of a project, inspects the changelog between versions, and understands what changed across imports.

## Actors
- Authenticated user

## Preconditions
- User is signed in
- A project with at least two versions exists (created via duplicate import)

## Steps

### Happy Path
1. User navigates to `#/versions` (or opens **Version history** from the project menu).
2. `VersionsPage` loads.
3. Page shows a list of versions for the active project, newest first:
   - Version number
   - Import date
   - Block count, scenario count, environment count
4. User clicks a version row to expand it.
5. `ChangeList` component renders the diff:
   - Added blocks (green)
   - Removed blocks (red)
   - Modified blocks (amber)
   - Same for scenarios and environments
6. User can switch the active project to any historical version.

## Edge Cases
- **Single version** → no diff available; page shows version 1 info only.
- **No projects** → empty state.
- **Version with zero changes** → diff shows "No changes from previous version".

## Related Flows
- [07-project-management.md](./07-project-management.md)
- [03-openapi-import.md](./03-openapi-import.md)
