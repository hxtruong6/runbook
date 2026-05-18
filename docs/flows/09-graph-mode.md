# Flow 09 — Graph Mode

## Summary
A user switches a scenario from list mode to graph mode, rearranges nodes, connects them with conditional edges, and runs the graph.

## Actors
- Authenticated user

## Preconditions
- User is signed in
- An active scenario with at least two blocks exists

## Steps

### Happy Path — Switch to Graph Mode
1. User opens a scenario with 2+ blocks in list mode.
2. User clicks the **Graph** option in the segmented control at the top of the canvas.
3. `GraphCanvas` renders with auto-laid-out nodes for each block.
4. Start node is visible at the top.
5. Mode stored as `"graph"` in `rb_scenario_mode:{scenarioId}`.

### Happy Path — Connect Nodes
1. User clicks and drags from a node's output port to another node's input port.
2. An edge is created between the two nodes.

### Happy Path — Set Edge Condition
1. User clicks on an edge → `EdgeConditionPopover` appears.
2. User fills in:
   - JSONPath: `$.status`
   - Operator: `eq`
   - Value: `200`
3. User clicks **Save**.
4. Edge label updates to show the condition.

### Happy Path — Run Graph
1. User clicks **Run all** in the TopBar.
2. Graph runner traverses nodes following edge conditions.
3. Each node status badge updates (running → ok/error).
4. Nodes whose conditions are not met are skipped (gray badge).

### Happy Path — Switch Back to List
1. User clicks **List** in the segmented control.
2. List view renders; graph data preserved for next switch.

## Edge Cases
- **Cycle detected** → app warns user; run does not start.
- **Disconnected node** → node is never reached; stays in idle state.
- **Reload** → graph mode and node positions are preserved.

## Related Flows
- [02-api-testing-curl.md](./02-api-testing-curl.md)
- [16-context-data-flow.md](./16-context-data-flow.md)
