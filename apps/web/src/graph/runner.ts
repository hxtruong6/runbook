// src/graph/runner.ts
import type { BlockDef, BlockRunResult, RuntimeContext } from "../blocks/types";
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
  onNodeStart?: (nodeId: string) => void,
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
    const nodeId = node.blockInstance.id;
    onNodeStart?.(nodeId);
    const { result, nextCtx, abort } = await runOneBlockFn(
      node.blockInstance,
      ctx,
      expandingIds,
      scenarioLookup,
      env,
      registry,
      (_newCtx, _idx, _res) => { /* no-op: we call onResult ourselves below */ },
      idx,
    );
    ctx = nextCtx;
    onResult(ctx, nodeId, result);

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
