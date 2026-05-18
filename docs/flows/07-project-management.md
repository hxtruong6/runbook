# Flow 07 — Project Management

## Summary
A user creates, switches, imports, and deletes projects. Importing a bundle twice triggers the version-bump flow.

## Actors
- Authenticated user

## Preconditions
- User is signed in

## Steps

### Happy Path — Create Project
1. User opens the **ProjectSwitcher** dropdown in the sidebar.
2. User clicks **+ New project**.
3. Modal opens with a text input.
4. User enters project name and clicks **Create**.
5. New project appears in the dropdown and is set as active.
6. Scenario list shows empty state.

### Happy Path — Switch Project
1. User opens the ProjectSwitcher dropdown.
2. User selects a different project.
3. Scenario list updates to show that project's scenarios.
4. Block library updates to show that project's bundle blocks.

### Happy Path — Import Bundle from File
1. User opens the sidebar **Import** menu.
2. User selects **From file** → file picker opens.
3. User selects a valid `bundle.json` file.
4. Bundle is parsed and imported as a new project.
5. App switches to the new project.

### Happy Path — Duplicate Import (Version Bump)
1. User imports the same bundle file again.
2. App detects existing project name match.
3. Version-bump modal appears showing diff (changed blocks, scenarios, envs).
4. User clicks **Add as new version** → project gains a new version.

### Happy Path — Delete Project
1. User opens the ProjectSwitcher → **⋯** menu on a project.
2. User clicks **Delete** → confirm dialog.
3. User confirms → project and all its scenarios are removed.
4. App switches to the next available project or shows empty state.

## Edge Cases
- **Empty project name** → validation error; create button disabled.
- **Delete only project** → empty state shown; no active project.
- **Invalid bundle JSON** → schema validation error alert.
- **Cancel version-bump modal** → existing project unchanged.

## Related Flows
- [03-openapi-import.md](./03-openapi-import.md)
- [22-version-history.md](./22-version-history.md)
