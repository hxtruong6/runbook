# Graph Flow Designer — Design Spec

**Date:** 2026-05-13  
**Status:** Approved

## Overview

Add an opt-in **graph mode** to scenarios. In graph mode, blocks become draggable nodes on a canvas connected by directed edges. Edges carry port type (ok/error) and optional response-based conditions, enabling full branching flows. List mode continues to work for all existing scenarios and can display graph-mode scenarios in read-only form.

---

## Data Model

New types live in `src/graph/types.ts`. The `Scenario` type gains one optional field.

```ts
type GraphNodeData = {
  blockInstance: BlockInstance;  // existing block or scenario-ref
  name: string;                  // user-assigned label e.g. "Login"
  position: { x: number; y: number };
};

type EdgeCondition = {
  jsonPath: string;    // dot-path into block response e.g. "data.status"
  operator: "eq" | "neq" | "gt" | "lt" | "contains";
  value: unknown;
};

type GraphEdge = {
  id: string;
  source: string;          // node id
  sourcePort: "ok" | "error";
  target: string;          // node id
  condition?: EdgeCondition;
};

type GraphData = {
  startNodeId: string;
  nodes: GraphNodeData[];  // includes a special kind:"start" node
  edges: GraphEdge[];
};
```

`Scenario.graphData?: GraphData` — present means graph mode, absent means list mode.

`Scenario.blocks[]` is always present. In graph mode it is derived from `graphData` (BFS order) on save, so existing run logic, export/import, and storage are untouched.

---

## Graph Canvas UI

**Mode toggle:** A `SegmentedControl` (`List` | `Graph`) in the scenario header. Switching to Graph for the first time initialises an empty `graphData` with a Start node. Switching back to List shows the BFS-derived block list in read-only mode.

**Nodes:**
- Card showing: editable node name, block kind badge, `ok` port handle (green, bottom-right), `error` port handle (red, bottom-right)
- **Start node:** grey, no input handle, single `ok` output port, cannot be deleted
- **Reusable scenario node:** expand button toggles an inline sub-graph inset (visual only — does not mutate the referenced scenario)

**Edges:**
- Curved lines connecting port handles
- Hover → popover to add/edit an `EdgeCondition`
- No outgoing edge from a port = silent stop at runtime (terminal)

**Toolbar (top of canvas):**
- `+ Block` — opens `AddBlockMenu`, drops node at canvas centre
- `+ Reusable` — opens `ScenarioRefPickerModal`, drops reusable node
- `Fit view` — zooms canvas to fit all nodes

**Node interactions:**
- Drag to reposition
- Click name to rename inline
- Right-click → context menu: Edit block fields | Delete node

**List mode when `graphData` present:**
- BFS walk from `startNodeId`, render `BlockCard` in discovery order
- Each card subtitle shows node name and branch origin: `[from: Login → ok]`
- Read-only — no add/remove blocks directly in list mode

---

## Execution Model

New `src/graph/runner.ts` — graph walker. Existing `runScenarioFrom` and `runOneBlock` are untouched.

**Algorithm:**

1. Start at `graphData.startNodeId`
2. Run node's `blockInstance` via `runOneBlock`
3. Determine fired port: `"ok"` or `"error"`
4. Filter outgoing edges by port
5. Evaluate `EdgeCondition` on each edge against block response; first match wins
6. Follow matched edge to next node — or stop if none
7. Repeat

**Condition evaluation** (`src/graph/evaluateCondition.ts`): extract value at `jsonPath` (dot-path), apply operator. First matching edge wins. Edges without a condition always match their port.

**Cycle detection:** reuse existing `expandingIds` Set from `runOneBlock`.

**Orphaned nodes** (not reachable from `startNodeId`): highlighted with a warning outline on the canvas. They are not executed.

---

## New Files

| File | Purpose |
|---|---|
| `src/graph/types.ts` | `GraphData`, `GraphEdge`, `GraphNodeData`, `EdgeCondition` |
| `src/graph/runner.ts` | Graph execution walker |
| `src/graph/deriveBlocks.ts` | BFS walk → `BlockInstance[]` for list mode |
| `src/graph/evaluateCondition.ts` | Edge condition evaluator |
| `src/components/GraphCanvas.tsx` | React Flow canvas |
| `src/components/GraphNode.tsx` | Node card component |
| `src/components/EdgeConditionPopover.tsx` | Condition editor popover |

---

## Testing

- **Unit:** graph walker (port selection, condition evaluation, cycle detection, orphan detection), `deriveBlocks` BFS ordering, `evaluateCondition` (all operators, missing path, type edge cases)
- **Integration:** graph-mode scenario round-trips export/import; list↔graph toggle preserves block instances; reusable expand does not mutate referenced scenario

---

## Scope

**In scope:**
- Graph canvas with React Flow
- Node drag, rename, connect, delete
- Edge condition editor popover
- Reusable node visual expand/collapse
- List mode read-only view of graph scenarios
- Graph runner

**Out of scope:**
- Parallel branch execution
- Auto-layout (manual positioning only)
- Step-through / debug mode in graph view
- Converting existing list-mode blocks to graph automatically
- Collaborative editing
