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
