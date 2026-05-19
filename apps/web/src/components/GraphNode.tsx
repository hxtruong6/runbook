// src/components/GraphNode.tsx
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { ActionIcon, Badge, Box, Group, Text, TextInput } from "@mantine/core";
import { IconChevronDown, IconChevronUp } from "@tabler/icons-react";
import { useState } from "react";
import type { GraphNodeData } from "../graph/types";
import type { RunStatus } from "./StatusBadge";
import { StatusBadge } from "./StatusBadge";

type GraphNodeProps = NodeProps & {
  data: GraphNodeData & {
    onRename: (id: string, name: string) => void;
    isOrphan: boolean;
    isExpanded: boolean;
    onToggleExpand: (id: string) => void;
    status?: RunStatus;
  };
};

const STATUS_BORDER: Partial<Record<RunStatus, string>> = {
  running: "var(--mantine-color-amber-5)",
  ok: "var(--mantine-color-sage-5)",
  err: "var(--mantine-color-coral-5)",
};

export function GraphNode({ data, selected }: GraphNodeProps) {
  const { blockInstance, name, onRename, isOrphan, isExpanded, onToggleExpand, status } = data;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const isStart = blockInstance.kind === "start";

  const statusBorder = status ? STATUS_BORDER[status] : undefined;
  const borderColor =
    statusBorder ??
    (isOrphan
      ? "var(--mantine-color-coral-4)"
      : selected
        ? "var(--mantine-color-indigo-5)"
        : "var(--mantine-color-gray-3)");

  return (
    <Box
      p="sm"
      data-flash={status === "ok" ? "ok" : status === "err" ? "err" : undefined}
      style={{
        border: `2px solid ${borderColor}`,
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
        <Badge size="xs" color="indigo" variant="light">{blockInstance.kind}</Badge>
        {isOrphan && <Badge size="xs" color="coral" variant="light">orphan</Badge>}
        {status && status !== "idle" && <StatusBadge status={status} size="xs" />}
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
            style={{ left: "35%", background: "var(--mantine-color-sage-6)" }}
          />
          <Handle
            type="source"
            position={Position.Bottom}
            id="error"
            style={{ left: "65%", background: "var(--mantine-color-coral-6)" }}
          />
        </>
      )}

      {!isStart && (
        <Group gap={4} mt={6} justify="space-between">
          <Text size="10px" c="sage">✓ ok</Text>
          <Text size="10px" c="coral">✗ error</Text>
        </Group>
      )}
    </Box>
  );
}
