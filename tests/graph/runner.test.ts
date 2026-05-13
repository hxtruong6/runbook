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
