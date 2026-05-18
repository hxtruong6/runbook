# Flow 14 — Nested Scenarios (Scenario Ref)

## Summary
A user marks a scenario as reusable, then embeds it as a `scenarioRef` block inside another scenario, and runs the parent scenario to see the nested execution.

## Actors
- Authenticated user

## Preconditions
- User is signed in
- At least two scenarios exist in the active project

## Steps

### Happy Path
1. User marks "Helper scenario" as **reusable** (see Flow 13).
2. User opens "Main scenario".
3. User clicks **Add block** → **Scenario reference**.
4. `ScenarioRefPickerModal` opens listing all reusable scenarios.
5. User selects "Helper scenario" and clicks **Add**.
6. A `ScenarioRefCard` block appears in "Main scenario".
7. User clicks **Run all**.
8. Main scenario executes its own blocks.
9. When the `scenarioRef` block is reached, "Helper scenario" runs inline.
10. All block results from "Helper scenario" appear nested inside the ref card.
11. Context captured by the helper scenario is merged into the parent context.

## Edge Cases
- **No reusable scenarios** → `ScenarioRefPickerModal` shows empty state.
- **Circular reference** → app detects cycle and shows error alert; run does not start.
- **Helper scenario deleted** → ref block shows "Unknown scenario" alert.
- **Helper scenario errors** → parent scenario marks the ref block as errored and stops (unless graph mode routes around it).

## Related Flows
- [13-scenario-lifecycle.md](./13-scenario-lifecycle.md)
- [09-graph-mode.md](./09-graph-mode.md)
