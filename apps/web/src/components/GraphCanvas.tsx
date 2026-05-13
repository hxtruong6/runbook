// src/components/GraphCanvas.tsx
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useReactFlow,
  ReactFlowProvider,
  applyNodeChanges,
  type Connection,
  type Edge,
  type Node,
  type NodeChange,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Button, Group, Text } from "@mantine/core";
import { IconScan } from "@tabler/icons-react";
import { useCallback, useEffect, useMemo, useState } from "react";
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

function toRFNode(
  n: GraphNodeData,
  orphanIds: Set<string>,
  onRename: (id: string, name: string) => void,
  expandedNodeIds: Set<string>,
  onToggleExpand: (id: string) => void,
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
    },
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

function GraphCanvasInner({ scenario, allScenarios, readOnly, onChange }: Props) {
  const graphData = scenario.graphData!;
  const { fitView } = useReactFlow();

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

  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(new Set());

  function toggleExpand(nodeId: string) {
    setExpandedNodeIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  }

  function handleRename(id: string, name: string) {
    updateGraphData({
      nodes: graphData.nodes.map((n) =>
        n.blockInstance.id === id ? { ...n, name } : n
      ),
    });
  }

  const rfNodes = useMemo(
    () => graphData.nodes.map((n) => toRFNode(n, orphanIds, handleRename, expandedNodeIds, toggleExpand)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [graphData.nodes, orphanIds, expandedNodeIds],
  );
  const rfEdges = useMemo(() => graphData.edges.map(toRFEdge), [graphData.edges]);

  // Local display nodes allow smooth dragging; synced from rfNodes when graphData changes.
  const [displayNodes, setDisplayNodes] = useState<Node[]>(rfNodes);
  useEffect(() => { setDisplayNodes(rfNodes); }, [rfNodes]);

  const onNodesChange = useCallback((changes: NodeChange<Node>[]) => {
    setDisplayNodes((nds) => applyNodeChanges(changes, nds));
    // Persist final position when drag ends
    for (const c of changes) {
      if (c.type === "position" && c.dragging === false && c.position) {
        updateGraphData({
          nodes: graphData.nodes.map((n) =>
            n.blockInstance.id === c.id ? { ...n, position: c.position! } : n
          ),
        });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graphData]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [graphData]
  );

  return (
    <>
      <div style={{ height: "70vh", border: "1px solid var(--mantine-color-gray-3)", borderRadius: "var(--mantine-radius-md)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {!readOnly && (
          <Group p="xs" gap="xs" style={{ flexShrink: 0, borderBottom: "1px solid var(--mantine-color-gray-2)" }}>
            <AddBlockMenu
              scenarios={allScenarios}
              currentScenarioId={scenario.id}
              onAdd={(inst) => {
                const newNode: GraphNodeData = {
                  blockInstance: inst,
                  name: inst.kind,
                  position: { x: 200, y: 200 },
                };
                updateGraphData({ nodes: [...graphData.nodes, newNode] });
              }}
            />
            <Button variant="default" size="xs" leftSection={<IconScan size={14} />} onClick={() => fitView({ duration: 300 })}>
              Fit view
            </Button>
          </Group>
        )}
        <div style={{ flex: 1, minHeight: 0 }}>
          <ReactFlow
            key={scenario.id}
            nodes={displayNodes}
            edges={rfEdges}
            nodeTypes={NODE_TYPES}
            onConnect={readOnly ? undefined : onConnect}
            onNodesChange={readOnly ? undefined : onNodesChange}
            fitView
          >
            <Background />
            <Controls />
            <MiniMap />
          </ReactFlow>
        </div>
      </div>
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
    </>
  );
}

export function GraphCanvas(props: Props) {
  return (
    <ReactFlowProvider>
      <GraphCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
