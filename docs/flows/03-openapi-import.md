# Flow 03 — OpenAPI Import

## Summary
A user imports an OpenAPI spec from a URL, previews the operations, creates a project, and runs a generated scenario. A second import of the same spec triggers the version-bump modal.

## Actors
- Authenticated user

## Preconditions
- User is signed in
- A valid OpenAPI spec URL is available

## Steps

### Happy Path — First Import
1. User opens the **Block Library** sidebar tab.
2. User clicks **+** → **Import OpenAPI spec**.
3. `OpenApiImporterModal` opens with a URL input field.
4. User enters the OpenAPI spec URL and clicks **Fetch**.
5. Spec is fetched and parsed; preview shows operation count and tags.
6. User reviews the list of operations (all selected by default).
7. User clicks **Import**.
8. A new project is created with blocks for each operation.
9. Scenarios are generated from the spec.
10. App switches to the newly created project automatically.
11. Block library populates with imported blocks.

### Happy Path — Duplicate Import (Version Bump)
1. User repeats steps 2–6 with the same spec URL.
2. App detects an existing project with the same name.
3. Version-bump modal appears showing:
   - Changed blocks
   - New scenarios
   - Updated environments
4. User clicks **Add as new version**.
5. Project gains a new version entry; scenarios and blocks are updated.

## Edge Cases
- **Invalid URL** → fetch error alert; retry available.
- **CORS error** → alert explaining CORS; no import occurs.
- **Spec parse error** → schema validation alert with details.
- **Zero operations selected** → Import button disabled.
- **Duplicate import cancelled** → existing project unchanged.

## Key State
- New `ProjectBundle` in `runbook:projects` with `versions[]`.
- Blocks stored under latest version.
- Active project switched to new import.

## Related Flows
- [07-project-management.md](./07-project-management.md)
- [04-block-library.md](./04-block-library.md)
- [22-version-history.md](./22-version-history.md)
