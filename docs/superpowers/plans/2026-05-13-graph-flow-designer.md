# Graph Flow Designer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an opt-in graph mode to scenarios, replacing the fixed block list with a draggable node canvas where edges express success/failure branching and optional response conditions.

**Architecture:** Each scenario gains an optional `graphData` field (nodes + edges). When present the app renders a React Flow canvas instead of the block list; when absent the existing list view is unchanged. A graph runner walks the graph at execution time, calling the existing `runOneBlock` at each step. `blocks[]` is derived from `graphData` via BFS on save so storage and export/import remain compatible.

**Tech Stack:** React Flow (`@xyflow/react`), Vitest, Zod, Mantine, TypeScript

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/graph/types.ts` | Create | `GraphData`, `GraphEdge`, `GraphNodeData`, `EdgeCondition` types + Zod schemas |
| `src/graph/evaluateCondition.ts` | Create | Evaluate one `EdgeCondition` against a response object |
| `src/graph/deriveBlocks.ts` | Create | BFS walk of `GraphData` → ordered `BlockInstance[]` |
| `src/graph/runner.ts` | Create | Walk graph, call `runOneBlock`, follow ports/conditions |
| `src/scenarios/types.ts` | Modify | Add `graphData?: GraphData` to `ScenarioSchema` |
| `src/components/GraphNode.tsx` | Create | React Flow custom node card (name, kind badge, ok/error handles) |
| `src/components/EdgeConditionPopover.tsx` | Create | Popover for editing `EdgeCondition` on an edge |
| `src/components/GraphCanvas.tsx` | Create | Main React Flow canvas wired to scenario graph data; reusable node expand inset |
| `src/App.tsx` | Modify | Mode toggle (List / Graph), render `GraphCanvas` in graph mode |
| `src/components/GraphNode.tsx` | Modify (Task 11) | Add expand button for scenario-ref nodes |
| `tests/graph/evaluateCondition.test.ts` | Create | Unit tests for condition evaluator |
| `tests/graph/deriveBlocks.test.ts` | Create | Unit tests for BFS deriver |
| `tests/graph/runner.test.ts` | Create | Unit tests for graph runner |

---

## Task 1: Install React Flow

**Files:**
- Modify: `package.json` / `pnpm-lock.yaml` (via pnpm)

- [ ] **Step 1: Install the package**

```bash
cd /path/to/project && pnpm add @xyflow/react
```

Expected: `pnpm-lock.yaml` updated, `@xyflow/react` appears in `dependencies`.

- [ ] **Step 2: Verify import resolves**

```bash
pnpm tsc --noEmit
```

Expected: no errors about `@xyflow/react`.

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add @xyflow/react dependency"
```

---

## Task 2: Graph Types

**Files:**
- Create: `src/graph/types.ts`

- [ ] **Step 1: Create the file**

```ts
// src/graph/types.ts
import { z } from "zod";
import { BlockInstanceSchema } from "../scenarios/types";

export const EdgeConditionSchema = z.object({
  jsonPath: z.string().min(1),
  operator: z.enum(["eq", "neq", "gt", "lt", "contains"]),
  value: z.unknown(),
});

export const GraphEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  sourcePort: z.enum(["ok", "error"]),
  target: z.string(),
  condition: EdgeConditionSchema.optional(),
});

export const GraphNodeDataSchema = z.object({
  blockInstance: BlockInstanceSchema,
  name: z.string(),
  position: z.object({ x: z.number(), y: z.number() }),
});

export const GraphDataSchema = z.object({
  startNodeId: z.string(),
  nodes: z.array(GraphNodeDataSchema),
  edges: z.array(GraphEdgeSchema),
});

export type EdgeCondition = z.infer<typeof EdgeConditionSchema>;
export type GraphEdge = z.infer<typeof GraphEdgeSchema>;
export type GraphNodeData = z.infer<typeof GraphNodeDataSchema>;
export type GraphData = z.infer<typeof GraphDataSchema>;
```

- [ ] **Step 2: Verify types compile**

```bash
pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/graph/types.ts
git commit -m "feat: add graph types and Zod schemas"
```

---

## Task 3: Update Scenario Schema

**Files:**
- Modify: `src/scenarios/types.ts`

- [ ] **Step 1: Import `GraphDataSchema` and extend `ScenarioSchema`**

Add after the existing imports at the top of `src/scenarios/types.ts`:

```ts
import { GraphDataSchema } from "../graph/types";
```

Then change `ScenarioSchema` to add the optional field:

```ts
export const ScenarioSchema = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.string(),
  blocks: z.array(BlockInstanceSchema),
  reusable: z.boolean().optional().default(false),
  graphData: GraphDataSchema.optional(),
});
```

- [ ] **Step 2: Verify no type errors**

```bash
pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/scenarios/types.ts
git commit -m "feat: add graphData field to Scenario schema"
```

---

## Task 4: Edge Condition Evaluator

**Files:**
- Create: `src/graph/evaluateCondition.ts`
- Create: `tests/graph/evaluateCondition.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// tests/graph/evaluateCondition.test.ts
import { describe, it, expect } from "vitest";
import { evaluateCondition } from "../../src/graph/evaluateCondition";
import type { EdgeCondition } from "../../src/graph/types";

const response = { data: { status: "active", count: 5, label: "hello world" } };

describe("evaluateCondition", () => {
  it("eq matches equal value", () => {
    const c: EdgeCondition = { jsonPath: "data.status", operator: "eq", value: "active" };
    expect(evaluateCondition(c, response)).toBe(true);
  });

  it("eq rejects unequal value", () => {
    const c: EdgeCondition = { jsonPath: "data.status", operator: "eq", value: "inactive" };
    expect(evaluateCondition(c, response)).toBe(false);
  });

  it("neq passes when different", () => {
    const c: EdgeCondition = { jsonPath: "data.status", operator: "neq", value: "inactive" };
    expect(evaluateCondition(c, response)).toBe(true);
  });

  it("gt passes when value is greater", () => {
    const c: EdgeCondition = { jsonPath: "data.count", operator: "gt", value: 3 };
    expect(evaluateCondition(c, response)).toBe(true);
  });

  it("lt passes when value is less", () => {
    const c: EdgeCondition = { jsonPath: "data.count", operator: "lt", value: 10 };
    expect(evaluateCondition(c, response)).toBe(true);
  });

  it("contains passes when string includes value", () => {
    const c: EdgeCondition = { jsonPath: "data.label", operator: "contains", value: "hello" };
    expect(evaluateCondition(c, response)).toBe(true);
  });

  it("returns false for missing jsonPath", () => {
    const c: EdgeCondition = { jsonPath: "data.missing", operator: "eq", value: "x" };
    expect(evaluateCondition(c, response)).toBe(false);
  });

  it("returns false for non-numeric gt comparison", () => {
    const c: EdgeCondition = { jsonPath: "data.status", operator: "gt", value: 1 };
    expect(evaluateCondition(c, response)).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
pnpm test tests/graph/evaluateCondition.test.ts
```

Expected: fails with "Cannot find module".

- [ ] **Step 3: Implement**

```ts
// src/graph/evaluateCondition.ts
import type { EdgeCondition } from "./types";

function getAtPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((cur, key) => {
    if (cur !== null && typeof cur === "object") {
      return (cur as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

export function evaluateCondition(condition: EdgeCondition, response: unknown): boolean {
  const actual = getAtPath(response, condition.jsonPath);
  if (actual === undefined) return false;
  const { operator, value } = condition;
  switch (operator) {
    case "eq": return actual === value;
    case "neq": return actual !== value;
    case "gt": return typeof actual === "number" && typeof value === "number" && actual > value;
    case "lt": return typeof actual === "number" && typeof value === "number" && actual < value;
    case "contains":
      return typeof actual === "string" && typeof value === "string" && actual.includes(value);
    default: return false;
  }
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
pnpm test tests/graph/evaluateCondition.test.ts
```

Expected: all 8 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/graph/evaluateCondition.ts tests/graph/evaluateCondition.test.ts
git commit -m "feat: add edge condition evaluator with tests"
```

---

## Task 5: BFS Block Deriver

**Files:**
- Create: `src/graph/deriveBlocks.ts`
- Create: `tests/graph/deriveBlocks.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// tests/graph/deriveBlocks.test.ts
import { describe, it, expect } from "vitest";
import { deriveBlocks } from "../../src/graph/deriveBlocks";
import type { GraphData } from "../../src/graph/types";

const makeNode = (id: string, kind: string) => ({
  blockInstance: { id, kind, overrides: {} },
  name: id,
  position: { x: 0, y: 0 },
});

describe("deriveBlocks", () => {
  it("returns empty array for graph with only start node", () => {
    const g: GraphData = {
      startNodeId: "start",
      nodes: [makeNode("start", "start")],
      edges: [],
    };
    expect(deriveBlocks(g)).toEqual([]);
  });

  it("returns blocks in BFS order from start", () => {
    const g: GraphData = {
      startNodeId: "start",
      nodes: [
        makeNode("start", "start"),
        makeNode("a", "signin"),
        makeNode("b", "profile"),
      ],
      edges: [
        { id: "e1", source: "start", sourcePort: "ok", target: "a" },
        { id: "e2", source: "a", sourcePort: "ok", target: "b" },
      ],
    };
    const result = deriveBlocks(g);
    expect(result.map((b) => b.id)).toEqual(["a", "b"]);
  });

  it("excludes orphaned nodes not reachable from start", () => {
    const g: GraphData = {
      startNodeId: "start",
      nodes: [
        makeNode("start", "start"),
        makeNode("a", "signin"),
        makeNode("orphan", "profile"),
      ],
      edges: [
        { id: "e1", source: "start", sourcePort: "ok", target: "a" },
      ],
    };
    const result = deriveBlocks(g);
    expect(result.map((b) => b.id)).toEqual(["a"]);
  });

  it("handles branching — visits all reachable nodes once", () => {
    const g: GraphData = {
      startNodeId: "start",
      nodes: [
        makeNode("start", "start"),
        makeNode("a", "signin"),
        makeNode("b", "profile"),
        makeNode("c", "capture"),
      ],
      edges: [
        { id: "e1", source: "start", sourcePort: "ok", target: "a" },
        { id: "e2", source: "a", sourcePort: "ok", target: "b" },
        { id: "e3", source: "a", sourcePort: "error", target: "c" },
      ],
    };
    const result = deriveBlocks(g);
    expect(result.map((b) => b.id)).toEqual(["a", "b", "c"]);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
pnpm test tests/graph/deriveBlocks.test.ts
```

Expected: fails with "Cannot find module".

- [ ] **Step 3: Implement**

```ts
// src/graph/deriveBlocks.ts
import type { BlockInstance } from "../blocks/types";
import type { GraphData } from "./types";

export function deriveBlocks(graphData: GraphData): BlockInstance[] {
  const nodeMap = new Map(graphData.nodes.map((n) => [n.blockInstance.id, n]));
  const visited = new Set<string>();
  const result: BlockInstance[] = [];
  const queue: string[] = [graphData.startNodeId];

  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    if (visited.has(nodeId)) continue;
    visited.add(nodeId);

    const node = nodeMap.get(nodeId);
    if (!node) continue;

    // skip the start node itself — it has no real block instance
    if (node.blockInstance.kind !== "start") {
      result.push(node.blockInstance);
    }

    const outgoing = graphData.edges
      .filter((e) => e.source === nodeId)
      .map((e) => e.target);
    queue.push(...outgoing);
  }

  return result;
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
pnpm test tests/graph/deriveBlocks.test.ts
```

Expected: all 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/graph/deriveBlocks.ts tests/graph/deriveBlocks.test.ts
git commit -m "feat: add BFS block deriver with tests"
```

---

## Task 6: Graph Runner

**Files:**
- Create: `src/graph/runner.ts`
- Create: `tests/graph/runner.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// tests/graph/runner.test.ts
import { describe, it, expect, vi } from "vitest";
import { runGraph } from "../../src/graph/runner";
import type { GraphData } from "../../src/graph/types";
import type { BlockRunResult, RuntimeContext } from "../../src/blocks/types";
import type { Scenario } from "../../src/scenarios/types";

const makeNode = (id: string, kind = "signin") => ({
  blockInstance: { id, kind, overrides: {} },
  name: id,
  position: { x: 0, y: 0 },
});

const okResult: BlockRunResult = {
  status: "ok", httpStatus: 200, elapsedMs: 10, response: { data: { status: "active" } }, captured: { token: "abc" },
};
const errResult: BlockRunResult = {
  status: "err", httpStatus: 401, elapsedMs: 5, response: null, error: "Unauthorized",
};

const ctx: RuntimeContext = { socketSessionUuid: "u" };
const registry = {};
const scenarioLookup = (_id: string): Scenario | null => null;

describe("runGraph", () => {
  it("walks ok path and calls onResult for each node", async () => {
    const runOneBlock = vi.fn().mockResolvedValue({ result: okResult, nextCtx: ctx, abort: false });
    const onResult = vi.fn();

    const g: GraphData = {
      startNodeId: "start",
      nodes: [makeNode("start", "start"), makeNode("a"), makeNode("b")],
      edges: [
        { id: "e1", source: "start", sourcePort: "ok", target: "a" },
        { id: "e2", source: "a", sourcePort: "ok", target: "b" },
      ],
    };

    await runGraph(g, ctx, onResult, null, registry, scenarioLookup, runOneBlock);
    expect(runOneBlock).toHaveBeenCalledTimes(2); // a and b, not start
    expect(onResult).toHaveBeenCalledTimes(2);
  });

  it("follows error port when block fails", async () => {
    const runOneBlock = vi.fn()
      .mockResolvedValueOnce({ result: errResult, nextCtx: ctx, abort: false })
      .mockResolvedValueOnce({ result: okResult, nextCtx: ctx, abort: false });
    const onResult = vi.fn();

    const g: GraphData = {
      startNodeId: "start",
      nodes: [makeNode("start", "start"), makeNode("a"), makeNode("err-handler")],
      edges: [
        { id: "e1", source: "start", sourcePort: "ok", target: "a" },
        { id: "e2", source: "a", sourcePort: "error", target: "err-handler" },
      ],
    };

    await runGraph(g, ctx, onResult, null, registry, scenarioLookup, runOneBlock);
    expect(runOneBlock).toHaveBeenCalledTimes(2);
  });

  it("stops when no outgoing edge matches (terminal node)", async () => {
    const runOneBlock = vi.fn().mockResolvedValue({ result: okResult, nextCtx: ctx, abort: false });
    const onResult = vi.fn();

    const g: GraphData = {
      startNodeId: "start",
      nodes: [makeNode("start", "start"), makeNode("a")],
      edges: [
        { id: "e1", source: "start", sourcePort: "ok", target: "a" },
        // a has no outgoing edges
      ],
    };

    await runGraph(g, ctx, onResult, null, registry, scenarioLookup, runOneBlock);
    expect(runOneBlock).toHaveBeenCalledTimes(1);
  });

  it("evaluates edge condition and skips non-matching edge", async () => {
    const runOneBlock = vi.fn()
      .mockResolvedValueOnce({
        result: { ...okResult, response: { data: { status: "inactive" } } },
        nextCtx: ctx,
        abort: false,
      })
      .mockResolvedValueOnce({ result: okResult, nextCtx: ctx, abort: false });
    const onResult = vi.fn();

    const g: GraphData = {
      startNodeId: "start",
      nodes: [makeNode("start", "start"), makeNode("a"), makeNode("b-active"), makeNode("b-inactive")],
      edges: [
        { id: "e1", source: "start", sourcePort: "ok", target: "a" },
        { id: "e2", source: "a", sourcePort: "ok", target: "b-active", condition: { jsonPath: "data.status", operator: "eq", value: "active" } },
        { id: "e3", source: "a", sourcePort: "ok", target: "b-inactive", condition: { jsonPath: "data.status", operator: "eq", value: "inactive" } },
      ],
    };

    await runGraph(g, ctx, onResult, null, registry, scenarioLookup, runOneBlock);
    // a runs, then b-inactive runs (condition matched), not b-active
    const secondCall = runOneBlock.mock.calls[1][0];
    expect(secondCall.id).toBe("b-inactive");
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
pnpm test tests/graph/runner.test.ts
```

Expected: fails with "Cannot find module".

- [ ] **Step 3: Implement**

```ts
// src/graph/runner.ts
import type { BlockDef, BlockInstance, BlockRunResult, RuntimeContext } from "../blocks/types";
import type { Environment } from "../environments/types";
import type { Scenario } from "../scenarios/types";
import type { GraphData } from "./types";
import { evaluateCondition } from "./evaluateCondition";
import { runOneBlock } from "../execution/runScenario";

type RunOneBlockFn = typeof runOneBlock;

export async function runGraph(
  graphData: GraphData,
  initialCtx: RuntimeContext,
  onResult: (ctx: RuntimeContext, nodeId: string, result: BlockRunResult) => void,
  env: Environment | null | undefined,
  registry: Record<string, BlockDef>,
  scenarioLookup: (id: string) => Scenario | null,
  runOneBlockFn: RunOneBlockFn = runOneBlock,
): Promise<void> {
  const nodeMap = new Map(graphData.nodes.map((n) => [n.blockInstance.id, n]));
  const expandingIds = new Set<string>();
  let ctx = initialCtx;
  let currentNodeId: string | null = graphData.startNodeId;

  while (currentNodeId !== null) {
    const node = nodeMap.get(currentNodeId);
    if (!node) break;

    // Start node is a no-op — skip execution, follow its ok edge
    if (node.blockInstance.kind === "start") {
      const nextEdge = graphData.edges.find(
        (e) => e.source === currentNodeId && e.sourcePort === "ok"
      );
      currentNodeId = nextEdge?.target ?? null;
      continue;
    }

    // Run the block
    const idx = 0; // index unused by graph runner, pass 0
    const { result, nextCtx, abort } = await runOneBlockFn(
      node.blockInstance,
      ctx,
      expandingIds,
      scenarioLookup,
      env,
      registry,
      (newCtx, _idx, res) => onResult(newCtx, node.blockInstance.id, res),
      idx,
    );
    ctx = nextCtx;

    if (abort) break;

    // Determine which port fired
    const port = result.status === "ok" ? "ok" : "error";

    // Find outgoing edges for this port
    const candidates = graphData.edges.filter(
      (e) => e.source === currentNodeId && e.sourcePort === port
    );

    // Pick first edge whose condition passes (or first unconditional)
    const nextEdge = candidates.find((e) => {
      if (!e.condition) return true;
      return evaluateCondition(e.condition, result.status === "ok" ? result.response : null);
    });

    currentNodeId = nextEdge?.target ?? null;
  }
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
pnpm test tests/graph/runner.test.ts
```

Expected: all 4 tests pass.

- [ ] **Step 5: Run full test suite to check for regressions**

```bash
pnpm test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/graph/runner.ts tests/graph/runner.test.ts
git commit -m "feat: add graph runner with port/condition routing"
```

---

## Task 7: GraphNode Component

**Files:**
- Create: `src/components/GraphNode.tsx`

- [ ] **Step 1: Create component**

```tsx
// src/components/GraphNode.tsx
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Badge, Box, Group, Text, TextInput } from "@mantine/core";
import { useState } from "react";
import type { GraphNodeData } from "../graph/types";

type GraphNodeProps = NodeProps & {
  data: GraphNodeData & { onRename: (id: string, name: string) => void; isOrphan: boolean };
};

export function GraphNode({ data, selected }: GraphNodeProps) {
  const { blockInstance, name, onRename, isOrphan } = data;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const isStart = blockInstance.kind === "start";

  return (
    <Box
      p="sm"
      style={{
        border: `2px solid ${isOrphan ? "var(--mantine-color-red-4)" : selected ? "var(--mantine-color-violet-5)" : "var(--mantine-color-gray-3)"}`,
        borderRadius: "var(--mantine-radius-md)",
        background: isStart ? "var(--mantine-color-gray-1)" : "var(--mantine-color-white)",
        minWidth: 160,
        cursor: "default",
      }}
    >
      {!isStart && (
        <Handle type="target" position={Position.Top} style={{ background: "var(--mantine-color-gray-5)" }} />
      )}

      <Group gap="xs" mb={4}>
        <Badge size="xs" color="violet" variant="light">{blockInstance.kind}</Badge>
        {isOrphan && <Badge size="xs" color="red" variant="light">orphan</Badge>}
      </Group>

      {editing ? (
        <TextInput
          size="xs"
          value={draft}
          onChange={(e) => setDraft(e.currentTarget.value)}
          onBlur={() => { setEditing(false); onRename(blockInstance.id, draft); }}
          onKeyDown={(e) => { if (e.key === "Enter") { setEditing(false); onRename(blockInstance.id, draft); } }}
          autoFocus
        />
      ) : (
        <Text size="sm" fw={500} onDoubleClick={() => { setDraft(name); setEditing(true); }}>
          {isStart ? "Start" : name}
        </Text>
      )}

      {!isStart && (
        <>
          <Handle
            type="source"
            position={Position.Bottom}
            id="ok"
            style={{ left: "35%", background: "var(--mantine-color-green-6)" }}
          />
          <Handle
            type="source"
            position={Position.Bottom}
            id="error"
            style={{ left: "65%", background: "var(--mantine-color-red-6)" }}
          />
        </>
      )}

      {!isStart && (
        <Group gap={4} mt={6} justify="space-between">
          <Text size="10px" c="green">✓ ok</Text>
          <Text size="10px" c="red">✗ error</Text>
        </Group>
      )}
    </Box>
  );
}
```

- [ ] **Step 2: Verify types compile**

```bash
pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/GraphNode.tsx
git commit -m "feat: add GraphNode React Flow custom node"
```

---

## Task 8: EdgeConditionPopover

**Files:**
- Create: `src/components/EdgeConditionPopover.tsx`

- [ ] **Step 1: Create component**

```tsx
// src/components/EdgeConditionPopover.tsx
import { Button, Group, Popover, Select, Stack, TextInput } from "@mantine/core";
import { useState } from "react";
import type { EdgeCondition } from "../graph/types";

type Props = {
  condition?: EdgeCondition;
  onSave: (condition: EdgeCondition | undefined) => void;
  children: React.ReactNode;
};

const OPERATORS: { value: EdgeCondition["operator"]; label: string }[] = [
  { value: "eq", label: "equals" },
  { value: "neq", label: "not equals" },
  { value: "gt", label: "greater than" },
  { value: "lt", label: "less than" },
  { value: "contains", label: "contains" },
];

export function EdgeConditionPopover({ condition, onSave, children }: Props) {
  const [opened, setOpened] = useState(false);
  const [jsonPath, setJsonPath] = useState(condition?.jsonPath ?? "");
  const [operator, setOperator] = useState<EdgeCondition["operator"]>(condition?.operator ?? "eq");
  const [value, setValue] = useState(String(condition?.value ?? ""));

  function handleSave() {
    if (jsonPath.trim()) {
      onSave({ jsonPath: jsonPath.trim(), operator, value });
    } else {
      onSave(undefined);
    }
    setOpened(false);
  }

  function handleClear() {
    onSave(undefined);
    setOpened(false);
  }

  return (
    <Popover opened={opened} onChange={setOpened} withArrow shadow="md">
      <Popover.Target>
        <span onClick={() => setOpened((o) => !o)} style={{ cursor: "pointer" }}>
          {children}
        </span>
      </Popover.Target>
      <Popover.Dropdown>
        <Stack gap="xs" w={280}>
          <TextInput
            label="JSON path"
            placeholder="data.status"
            size="xs"
            value={jsonPath}
            onChange={(e) => setJsonPath(e.currentTarget.value)}
          />
          <Select
            label="Operator"
            size="xs"
            value={operator}
            onChange={(v) => setOperator(v as EdgeCondition["operator"])}
            data={OPERATORS}
          />
          <TextInput
            label="Value"
            size="xs"
            value={value}
            onChange={(e) => setValue(e.currentTarget.value)}
          />
          <Group justify="flex-end" gap="xs">
            <Button variant="subtle" size="xs" onClick={handleClear}>Clear</Button>
            <Button size="xs" onClick={handleSave}>Save</Button>
          </Group>
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}
```

- [ ] **Step 2: Verify types compile**

```bash
pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/EdgeConditionPopover.tsx
git commit -m "feat: add EdgeConditionPopover for editing edge conditions"
```

---

## Task 9: GraphCanvas Component

**Files:**
- Create: `src/components/GraphCanvas.tsx`

- [ ] **Step 1: Create component**

```tsx
// src/components/GraphCanvas.tsx
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Connection,
  type Edge,
  type Node,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Button, Group } from "@mantine/core";
import { IconPlus } from "@tabler/icons-react";
import { useCallback, useMemo } from "react";
import type { GraphData, GraphEdge, GraphNodeData } from "../graph/types";
import type { Scenario } from "../scenarios/types";
import { GraphNode } from "./GraphNode";
import { deriveBlocks } from "../graph/deriveBlocks";
import { AddBlockMenu } from "./AddBlockMenu";

const NODE_TYPES = { graphNode: GraphNode };

type Props = {
  scenario: Scenario;
  allScenarios: Scenario[];
  readOnly: boolean;
  onChange: (updated: Scenario) => void;
};

function toRFNode(n: GraphNodeData, orphanIds: Set<string>, onRename: (id: string, name: string) => void): Node {
  return {
    id: n.blockInstance.id,
    type: "graphNode",
    position: n.position,
    data: { ...n, onRename, isOrphan: orphanIds.has(n.blockInstance.id) },
  };
}

function toRFEdge(e: GraphEdge): Edge {
  return {
    id: e.id,
    source: e.source,
    sourceHandle: e.sourcePort,
    target: e.target,
    markerEnd: { type: MarkerType.ArrowClosed },
    label: e.condition ? `${e.condition.jsonPath} ${e.condition.operator} ${e.condition.value}` : e.sourcePort,
    style: { stroke: e.sourcePort === "ok" ? "var(--mantine-color-green-6)" : "var(--mantine-color-red-6)" },
  };
}

export function GraphCanvas({ scenario, allScenarios, readOnly, onChange }: Props) {
  const graphData = scenario.graphData!;

  const reachableIds = useMemo(() => {
    const visited = new Set<string>();
    const queue = [graphData.startNodeId];
    while (queue.length) {
      const id = queue.shift()!;
      if (visited.has(id)) continue;
      visited.add(id);
      graphData.edges.filter((e) => e.source === id).forEach((e) => queue.push(e.target));
    }
    return visited;
  }, [graphData]);

  const orphanIds = useMemo(() => {
    const ids = new Set(graphData.nodes.map((n) => n.blockInstance.id));
    reachableIds.forEach((id) => ids.delete(id));
    return ids;
  }, [graphData.nodes, reachableIds]);

  function updateGraphData(updated: Partial<GraphData>) {
    const next = { ...graphData, ...updated };
    onChange({ ...scenario, graphData: next, blocks: deriveBlocks(next) });
  }

  function handleRename(id: string, name: string) {
    updateGraphData({
      nodes: graphData.nodes.map((n) =>
        n.blockInstance.id === id ? { ...n, name } : n
      ),
    });
  }

  // React Flow is used in controlled mode — nodes/edges derived from graphData each render.
  // Use scenario.id as key on ReactFlow to remount when switching scenarios, avoiding
  // stale internal state from the previous scenario's drag positions.
  const rfNodes = graphData.nodes.map((n) => toRFNode(n, orphanIds, handleRename));
  const rfEdges = graphData.edges.map(toRFEdge);

  const onConnect = useCallback(
    (connection: Connection) => {
      const newEdge: GraphEdge = {
        id: crypto.randomUUID(),
        source: connection.source,
        sourcePort: (connection.sourceHandle as "ok" | "error") ?? "ok",
        target: connection.target,
      };
      updateGraphData({ edges: [...graphData.edges, newEdge] });
    },
    [graphData]
  );

  function onNodeDragStop(_: React.MouseEvent, node: Node) {
    updateGraphData({
      nodes: graphData.nodes.map((n) =>
        n.blockInstance.id === node.id ? { ...n, position: node.position } : n
      ),
    });
  }

  return (
    <div style={{ height: "70vh", border: "1px solid var(--mantine-color-gray-3)", borderRadius: "var(--mantine-radius-md)" }}>
      {!readOnly && (
        <Group p="xs" gap="xs">
          <AddBlockMenu
            onAdd={(inst) => {
              const newNode: GraphNodeData = {
                blockInstance: inst,
                name: inst.kind,
                position: { x: 200, y: 200 },
              };
              updateGraphData({ nodes: [...graphData.nodes, newNode] });
            }}
          />
          <Button variant="default" size="xs" leftSection={<IconPlus size={14} />}>
            Fit view
          </Button>
        </Group>
      )}
      <ReactFlow
        key={scenario.id}
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={NODE_TYPES}
        onConnect={readOnly ? undefined : onConnect}
        onNodeDragStop={readOnly ? undefined : onNodeDragStop}
        fitView
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
}
```

- [ ] **Step 2: Verify types compile**

```bash
pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/GraphCanvas.tsx
git commit -m "feat: add GraphCanvas React Flow component"
```

---

## Task 10: Wire into App.tsx

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Add graph mode state and mode toggle to scenario header**

In `App.tsx`, add a per-scenario mode state and the `GraphCanvas`. First add the import at the top:

```tsx
import { GraphCanvas } from "./components/GraphCanvas";
import { runGraph } from "./graph/runner";
import type { GraphData } from "./graph/types";
```

Add a state variable inside `App()`:

```tsx
const [graphMode, setGraphMode] = useState<Record<string, "list" | "graph">>({});
const activeMode = active ? (graphMode[active.id] ?? (active.graphData ? "graph" : "list")) : "list";
```

Add a helper to initialise `graphData` when switching to graph mode for the first time:

```tsx
function enableGraphMode(scenario: Scenario) {
  if (scenario.graphData) {
    setGraphMode((m) => ({ ...m, [scenario.id]: "graph" }));
    return;
  }
  const startId = crypto.randomUUID();
  const initialGraphData: GraphData = {
    startNodeId: startId,
    nodes: scenario.blocks.map((b, i) => ({
      blockInstance: b,
      name: b.kind,
      position: { x: 200, y: 80 + i * 120 },
    })).concat([{
      blockInstance: { id: startId, kind: "start", overrides: {} },
      name: "Start",
      position: { x: 200, y: 0 },
    }]),
    edges: [],
  };
  const updated = { ...scenario, graphData: initialGraphData };
  updateActive(updated);
  setGraphMode((m) => ({ ...m, [scenario.id]: "graph" }));
}
```

- [ ] **Step 2: Replace the blocks view section with mode-aware render**

In `App.tsx`, inside `AppShell.Main`, find the existing `view === "blocks"` branch that renders `BlockCard` items. Wrap the entire blocks section with the mode toggle and graph canvas. The structure becomes:

```tsx
{view === "blocks" && active && (
  <>
    {/* Mode toggle */}
    <Group mb="md">
      <SegmentedControl
        size="xs"
        value={activeMode}
        onChange={(v) => {
          if (v === "graph") enableGraphMode(active);
          else setGraphMode((m) => ({ ...m, [active.id]: "list" }));
        }}
        data={[
          { label: "List", value: "list" },
          { label: "Graph", value: "graph" },
        ]}
      />
    </Group>

    {/* Graph canvas */}
    {activeMode === "graph" && active.graphData && (
      <GraphCanvas
        scenario={active}
        allScenarios={displayScenarios}
        readOnly={!!activeProject}
        onChange={updateActive}
      />
    )}

    {/* List view — keep all existing BlockCard rendering unchanged */}
    {activeMode === "list" && (
      <>
        {/* This is the existing block list code already in App.tsx — do not remove it,
            just wrap it inside this conditional. */}
      </>
    )}
  </>
)}
```

The existing block list code (the `Stack` with `BlockCard` items, `AddBlockMenu`, empty state, etc.) moves inside the `activeMode === "list"` branch unchanged.
```

- [ ] **Step 3: Update `runFrom` to use graph runner when in graph mode**

```tsx
async function runFrom(startIdx: number) {
  if (!active) return;
  if (activeMode === "graph" && active.graphData) {
    await runGraph(
      active.graphData,
      context,
      (newCtx, _nodeId, _result) => dispatch({ type: "MERGE", values: newCtx }),
      activeEnv,
      registry,
      (id) => displayScenarios.find((s) => s.id === id) ?? null,
    );
  } else {
    await runScenarioFrom(active.blocks, startIdx, context, (newCtx) => {
      dispatch({ type: "MERGE", values: newCtx });
    }, activeEnv, registry);
  }
}
```

- [ ] **Step 4: Verify app compiles and starts**

```bash
pnpm tsc --noEmit && pnpm dev
```

Expected: no compile errors, dev server starts, List/Graph toggle visible when a scenario is selected.

- [ ] **Step 5: Manual smoke test**
  - Open a scenario, switch to Graph mode — see the canvas with a Start node
  - Drag the Start node — position updates
  - Switch back to List — blocks shown in read-only list with node names
  - Run the scenario in Graph mode — execution walks the graph

- [ ] **Step 6: Run full test suite**

```bash
pnpm test
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx
git commit -m "feat: wire graph mode toggle and GraphCanvas into App"
```

---

## Task 11: Reusable Node Expand/Collapse

**Files:**
- Modify: `src/components/GraphNode.tsx`
- Modify: `src/components/GraphCanvas.tsx`

A reusable scenario node (kind `scenario-ref`) shows an **expand button**. Clicking it renders the referenced scenario's `graphData` as an inset sub-graph inside the parent canvas. This is visual only — it does not mutate the referenced scenario.

- [ ] **Step 1: Add expanded state to GraphCanvas**

In `GraphCanvas`, add a state for which reusable nodes are expanded:

```tsx
const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(new Set());

function toggleExpand(nodeId: string) {
  setExpandedNodeIds((prev) => {
    const next = new Set(prev);
    if (next.has(nodeId)) next.delete(nodeId);
    else next.add(nodeId);
    return next;
  });
}
```

Pass `onToggleExpand: (id: string) => void` and `isExpanded: boolean` into each node's `data` alongside `onRename` and `isOrphan`:

```tsx
function toRFNode(
  n: GraphNodeData,
  orphanIds: Set<string>,
  onRename: (id: string, name: string) => void,
  expandedNodeIds: Set<string>,
  onToggleExpand: (id: string) => void,
  allScenarios: Scenario[],
): Node {
  return {
    id: n.blockInstance.id,
    type: "graphNode",
    position: n.position,
    data: {
      ...n,
      onRename,
      isOrphan: orphanIds.has(n.blockInstance.id),
      isExpanded: expandedNodeIds.has(n.blockInstance.id),
      onToggleExpand,
      allScenarios,
    },
  };
}
```

Update the `rfNodes` derivation call to pass `expandedNodeIds`, `toggleExpand`, and `allScenarios`.

- [ ] **Step 2: Render inline sub-graph when expanded**

After the main `ReactFlow` div, add an overlay for expanded nodes. For each expanded node, find the referenced scenario and render its graph as a `<GraphCanvas>` inset below the parent canvas:

```tsx
{graphData.nodes
  .filter((n) => expandedNodeIds.has(n.blockInstance.id) && n.blockInstance.kind === "scenario-ref")
  .map((n) => {
    const refId = (n.blockInstance.overrides as { scenarioId?: string }).scenarioId;
    const refScenario = allScenarios.find((s) => s.id === refId);
    if (!refScenario?.graphData) return null;
    return (
      <div
        key={n.blockInstance.id}
        style={{
          border: "2px dashed var(--mantine-color-violet-4)",
          borderRadius: "var(--mantine-radius-md)",
          padding: "var(--mantine-spacing-sm)",
          marginTop: "var(--mantine-spacing-sm)",
          background: "var(--mantine-color-violet-0)",
        }}
      >
        <Text size="xs" c="violet" fw={600} mb="xs">
          Expanded: {refScenario.name}
        </Text>
        <GraphCanvas
          scenario={refScenario}
          allScenarios={allScenarios}
          readOnly={true}
          onChange={() => {}}
        />
      </div>
    );
  })}
```

- [ ] **Step 3: Add expand button to GraphNode**

In `GraphNode.tsx`, update the `data` type to include `isExpanded`, `onToggleExpand`, and check if the node is a `scenario-ref`:

```tsx
type GraphNodeProps = NodeProps & {
  data: GraphNodeData & {
    onRename: (id: string, name: string) => void;
    isOrphan: boolean;
    isExpanded: boolean;
    onToggleExpand: (id: string) => void;
    allScenarios: unknown[];
  };
};
```

Inside the node JSX, after the name, add the expand button only for `scenario-ref` nodes:

```tsx
{blockInstance.kind === "scenario-ref" && (
  <ActionIcon
    size="xs"
    variant="subtle"
    aria-label={isExpanded ? "Collapse sub-scenario" : "Expand sub-scenario"}
    onClick={() => onToggleExpand(blockInstance.id)}
    mt={4}
  >
    {isExpanded ? <IconChevronUp size={12} /> : <IconChevronDown size={12} />}
  </ActionIcon>
)}
```

Add the imports at the top of `GraphNode.tsx`:

```tsx
import { ActionIcon } from "@mantine/core";
import { IconChevronDown, IconChevronUp } from "@tabler/icons-react";
```

- [ ] **Step 4: Verify types compile**

```bash
pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Manual test**
  - Add a `scenario-ref` node to a graph-mode scenario
  - Click the expand button — inset canvas appears showing the referenced scenario's graph
  - Click again — inset collapses
  - The referenced scenario's own `graphData` is not modified

- [ ] **Step 6: Commit**

```bash
git add src/components/GraphNode.tsx src/components/GraphCanvas.tsx
git commit -m "feat: reusable node expand/collapse shows inner graph"
```

---

## Task 13: Final Integration Check

- [ ] **Step 1: Run linter**

```bash
pnpm lint
```

Expected: no design-system violations.

- [ ] **Step 2: Run full test suite**

```bash
pnpm test
```

Expected: all tests pass.

- [ ] **Step 3: Manual end-to-end test**
  - Create a new scenario, switch to Graph
  - Add two blocks from `+ Block`, connect Start → A (ok) → B
  - Add a condition on the A → B edge (`data.status eq active`)
  - Run — verify execution follows correct branch
  - Switch back to List — verify both blocks appear with branch labels
  - Export scenario, re-import — verify `graphData` round-trips correctly

- [ ] **Step 4: Commit**

```bash
git commit --allow-empty -m "chore: graph flow designer feature complete"
```
