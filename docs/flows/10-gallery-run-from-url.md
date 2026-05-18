# Flow 10 — Gallery & Run-from-URL

## Summary
A user browses the community gallery, views bundle details, imports a bundle into their workspace, and also runs a scenario directly from a shareable URL.

## Actors
- Authenticated or unauthenticated user

## Steps

### Happy Path — Browse Gallery
1. User navigates to `#/gallery`.
2. Gallery page loads showing up to 8 community bundle cards.
3. User types in the search box → cards filter by name/description/tags.
4. User clicks a card → navigates to `#/gallery/<slug>`.
5. Detail page shows:
   - Title, description, version info
   - Blocks table (kind, method badge, endpoint)
   - Scenarios list
   - Environments table
6. User clicks **Open in Runbook** → bundle imported into workspace.
7. App navigates to main workspace with the bundle active.

### Happy Path — Run from URL
1. User visits `#/run?bundle=<url>&scenario=<id>`.
2. `RunFromUrl` page fetches the bundle JSON.
3. Loading skeleton renders during fetch.
4. Bundle validates against schema.
5. **Import & run** button appears.
6. User clicks it → bundle imported; specified scenario is selected and run.
7. **Open workspace** button appears after import.

## Edge Cases
- **Gallery search returns no results** → "No results" empty state.
- **Bundle detail fetch fails** → error alert + back button.
- **Run-from-URL: CORS error** → alert explaining CORS with back button.
- **Run-from-URL: schema validation error** → alert with validation details.
- **Run-from-URL: network error** → generic error alert + back button.
- **Run-from-URL: already imported** → re-import or update version.

## Related Flows
- [07-project-management.md](./07-project-management.md)
- [20-bundle-publish-embed.md](./20-bundle-publish-embed.md)
