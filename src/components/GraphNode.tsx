// src/components/GraphNode.tsx
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { ActionIcon, Badge, Box, Group, Text, TextInput } from "@mantine/core";
import { IconChevronDown, IconChevronUp } from "@tabler/icons-react";
import { useState } from "react";
import type { GraphNodeData } from "../graph/types";

type GraphNodeProps = NodeProps & {
  data: GraphNodeData & {
    onRename: (id: string, name: string) => void;
    isOrphan: boolean;
    isExpanded: boolean;
    onToggleExpand: (id: string) => void;
  };
};

export function GraphNode({ data, selected }: GraphNodeProps) {
  const { blockInstance, name, onRename, isOrphan, isExpanded, onToggleExpand } = data;
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
