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
