# Flow 13 — Scenario Lifecycle Management

## Summary
A user performs the full lifecycle of a scenario: rename, duplicate, toggle reusable flag, export to file, import from file, and delete.

## Actors
- Authenticated user

## Preconditions
- User is signed in
- At least one project with a scenario exists

## Steps

### Happy Path — Rename
1. User right-clicks (or opens **⋯** menu) on a scenario in the sidebar.
2. User selects **Rename**.
3. Modal opens with the current name pre-filled.
4. User changes the name and clicks **Save**.
5. Sidebar and TopBar update immediately with the new name.

### Happy Path — Duplicate
1. User opens the TopBar **More actions** menu.
2. User clicks **Duplicate scenario**.
3. A copy appears in the sidebar as "<name> (copy)".
4. The duplicate becomes the active scenario.

### Happy Path — Toggle Reusable
1. User opens the **⋯** menu on a scenario.
2. User clicks **Make reusable**.
3. A `ref` badge appears next to the scenario name in the sidebar.
4. The scenario is now available in the **ScenarioRefPickerModal**.
5. User toggles it off → `ref` badge disappears.

### Happy Path — Export
1. User opens the TopBar **More actions** menu.
2. User clicks **Export scenario**.
3. Browser downloads a `.json` file containing the scenario definition.

### Happy Path — Import
1. User opens the TopBar **More actions** menu.
2. User clicks **Import scenario**.
3. File picker opens; user selects a previously exported `.json` file.
4. Scenario is added to the current project.
5. Imported scenario appears in the sidebar and is selected.

### Happy Path — Delete
1. User opens the **⋯** menu on a scenario.
2. User clicks **Delete**.
3. Confirm dialog appears.
4. User confirms → scenario removed; next scenario in list is auto-selected.

## Edge Cases
- **Rename to empty string** → validation error; save blocked.
- **Delete last scenario** → empty state shown with create CTAs.
- **Import invalid JSON** → error alert; no scenario added.
- **Duplicate reusable scenario** → copy is also marked reusable.

## Related Flows
- [14-nested-scenarios.md](./14-nested-scenarios.md)
- [07-project-management.md](./07-project-management.md)
