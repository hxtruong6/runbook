# Flow 19 — GitHub Repository Import

## Summary
A user imports a Runbook bundle from a GitHub repository by searching for a `bundle.json` file and importing it as a project.

## Actors
- Authenticated user

## Preconditions
- User is signed in
- A GitHub repository containing a `bundle.json` or `runbook.json` is accessible

## Steps

### Happy Path
1. User opens the sidebar **Import** menu.
2. User selects **Import from GitHub**.
3. `GithubImport` modal opens with a repository search input.
4. User enters the repository owner/name (e.g. `org/repo`).
5. User clicks **Search**.
6. Modal searches the repo for `bundle.json` or `runbook.json`.
7. Found file is listed with its path.
8. User selects the file and clicks **Import**.
9. Bundle is fetched, validated, and imported as a project.
10. App switches to the newly imported project.

## Edge Cases
- **Repository not found** → "Repository not found" error alert.
- **No bundle file in repo** → "No bundle.json found in this repository" message.
- **Bundle fails schema validation** → error alert with validation details.
- **Private repository** → user prompted to authenticate with GitHub token.
- **Rate limited** → error alert with retry after time.

## Related Flows
- [07-project-management.md](./07-project-management.md)
- [03-openapi-import.md](./03-openapi-import.md)
