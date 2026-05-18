# Flow 24 — Command Palette

## Summary
A user opens the command palette with a keyboard shortcut to quickly switch scenarios, run a scenario by name, and navigate to recent items.

## Actors
- Authenticated user

## Preconditions
- User is signed in
- At least one project with scenarios exists

## Steps

### Happy Path — Switch Scenario
1. User presses **Cmd+K** (Mac) or **Ctrl+K** (Windows/Linux).
2. `CommandPalette` opens as an overlay.
3. User types part of a scenario name.
4. Matching scenarios appear in a filtered list.
5. User clicks a result (or presses Enter).
6. Palette closes; selected scenario becomes active.

### Happy Path — Run Scenario from Palette
1. User opens the palette and searches for a scenario.
2. Scenario result shows a **Run** action button.
3. User clicks **Run**.
4. Palette closes; scenario executes immediately.

### Happy Path — Recent Items
1. User opens the palette without typing.
2. Recently accessed scenarios and environment keys are shown.
3. User selects a recent item → navigated or applied.

### Happy Path — Toggle Color Scheme
1. User opens the palette and types "dark" or "light".
2. "Toggle dark mode" action appears.
3. User selects it → color scheme switches.

## Edge Cases
- **No matching scenario** → "No results" message.
- **Palette closes on Escape** → active scenario unchanged.
- **Palette closes on outside click** → active scenario unchanged.

## Key State
| Key | Value |
|-----|-------|
| `rb_palette_recent` | Last 8 recent items |

## Related Flows
- [13-scenario-lifecycle.md](./13-scenario-lifecycle.md)
- [02-api-testing-curl.md](./02-api-testing-curl.md)
