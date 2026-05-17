/**
 * RunDiff — unified / side-by-side JSON diff between two run results (UX-D3)
 *
 * Colors follow design-system rules from CLAUDE.md:
 *   green  = added
 *   red    = removed
 *   amber  = changed
 */

import { useMemo, useState } from "react";
import {
  Badge,
  Box,
  Code,
  Group,
  Paper,
  SegmentedControl,
  Stack,
  Text,
} from "@mantine/core";
import { diff, type Delta } from "jsondiffpatch";

// Helper guards — jsondiffpatch types module isn't re-exported from the main
// entry point, so we define them inline per the jsondiffpatch Delta spec.
function isAddedDelta(d: Delta): d is [unknown] {
  return Array.isArray(d) && d.length === 1;
}
function isDeletedDelta(d: Delta): d is [unknown, 0, 0] {
  return Array.isArray(d) && d.length === 3 && d[1] === 0 && d[2] === 0;
}
function isModifiedDelta(d: Delta): d is [unknown, unknown] {
  return Array.isArray(d) && d.length === 2;
}
function isArrayDelta(d: Delta): d is Record<string, Delta> & { _t: "a" } {
  return d !== undefined && typeof d === "object" && !Array.isArray(d) && (d as Record<string, unknown>)._t === "a";
}
function isObjectDelta(d: Delta): d is Record<string, Delta> {
  return d !== undefined && typeof d === "object" && !Array.isArray(d) && (d as Record<string, unknown>)._t !== "a";
}
import type { RunResultEntry } from "../../state/runHistory";

// ---------------------------------------------------------------------------
// Delta walking helpers — count changes and flatten to a renderable list
// ---------------------------------------------------------------------------

type DiffLine = {
  kind: "added" | "removed" | "changed";
  path: string;
  oldValue?: unknown;
  newValue?: unknown;
};

function walkDelta(delta: Delta, path: string, lines: DiffLine[]) {
  if (!delta) return;

  if (isAddedDelta(delta)) {
    lines.push({ kind: "added", path, newValue: delta[0] });
  } else if (isDeletedDelta(delta)) {
    lines.push({ kind: "removed", path, oldValue: delta[0] });
  } else if (isModifiedDelta(delta)) {
    lines.push({ kind: "changed", path, oldValue: delta[0], newValue: delta[1] });
  } else if (isArrayDelta(delta)) {
    const { _t: _ignored, ...rest } = delta;
    for (const key of Object.keys(rest)) {
      const child = (rest as Record<string, Delta>)[key];
      const index = key.startsWith("_") ? key.slice(1) : key;
      walkDelta(child, path ? `${path}[${index}]` : `[${index}]`, lines);
    }
  } else if (isObjectDelta(delta)) {
    for (const key of Object.keys(delta)) {
      walkDelta(delta[key], path ? `${path}.${key}` : key, lines);
    }
  }
}

function buildLines(delta: Delta): DiffLine[] {
  const lines: DiffLine[] = [];
  walkDelta(delta, "", lines);
  return lines;
}

// ---------------------------------------------------------------------------
// Color map following design-system tokens
// ---------------------------------------------------------------------------

const KIND_COLOR: Record<DiffLine["kind"], string> = {
  added: "green",
  removed: "red",
  changed: "amber",
};

const KIND_LABEL: Record<DiffLine["kind"], string> = {
  added: "added",
  removed: "removed",
  changed: "changed",
};

// ---------------------------------------------------------------------------
// Extract the response payload to diff from a RunResultEntry
// ---------------------------------------------------------------------------

function extractPayload(entry: RunResultEntry): unknown {
  // prefer the captured last-block response
  if (entry.lastResponse !== undefined) return entry.lastResponse;
  // fall back to the final block's response field
  const last = entry.blockResults[entry.blockResults.length - 1];
  return last?.response ?? null;
}

// ---------------------------------------------------------------------------
// DiffLine row
// ---------------------------------------------------------------------------

function DiffRow({ line }: { line: DiffLine }) {
  const color = KIND_COLOR[line.kind];
  return (
    <Group gap="xs" wrap="nowrap" align="flex-start">
      <Badge color={color} size="xs" style={{ flexShrink: 0, marginTop: 2 }}>
        {KIND_LABEL[line.kind]}
      </Badge>
      <Text size="xs" ff="monospace" style={{ wordBreak: "break-all" }}>
        {line.path || "(root)"}
      </Text>
      {line.kind === "changed" && (
        <Group gap={4} wrap="nowrap">
          <Code
            style={{ fontSize: "var(--mantine-font-size-xs)", color: "var(--mantine-color-red-7)" }}
          >
            {JSON.stringify(line.oldValue)}
          </Code>
          <Text size="xs" c="dimmed">→</Text>
          <Code
            style={{ fontSize: "var(--mantine-font-size-xs)", color: "var(--mantine-color-green-7)" }}
          >
            {JSON.stringify(line.newValue)}
          </Code>
        </Group>
      )}
      {line.kind === "added" && (
        <Code
          style={{ fontSize: "var(--mantine-font-size-xs)", color: "var(--mantine-color-green-7)" }}
        >
          {JSON.stringify(line.newValue)}
        </Code>
      )}
      {line.kind === "removed" && (
        <Code
          style={{ fontSize: "var(--mantine-font-size-xs)", color: "var(--mantine-color-red-7)" }}
        >
          {JSON.stringify(line.oldValue)}
        </Code>
      )}
    </Group>
  );
}

// ---------------------------------------------------------------------------
// RunDiff — public component
// ---------------------------------------------------------------------------

export type RunDiffViewMode = "unified" | "split";

type Props = {
  current: RunResultEntry;
  previous: RunResultEntry;
  defaultView?: RunDiffViewMode;
};

export function RunDiff({ current, previous, defaultView = "unified" }: Props) {
  const [viewMode, setViewMode] = useState<RunDiffViewMode>(defaultView);

  const { delta, lines, addedCount, removedCount, changedCount } = useMemo(() => {
    const left = extractPayload(previous);
    const right = extractPayload(current);
    const d = diff(left, right);
    const ls = buildLines(d);
    return {
      delta: d,
      lines: ls,
      addedCount: ls.filter((l) => l.kind === "added").length,
      removedCount: ls.filter((l) => l.kind === "removed").length,
      changedCount: ls.filter((l) => l.kind === "changed").length,
    };
  }, [current, previous]);

  const leftJson = JSON.stringify(extractPayload(previous), null, 2);
  const rightJson = JSON.stringify(extractPayload(current), null, 2);

  return (
    <Stack gap="xs" data-testid="run-diff">
      {/* Summary badges */}
      <Group gap="xs">
        <Text size="xs" c="dimmed" fw={600} tt="uppercase">Diff</Text>
        {addedCount > 0 && (
          <Badge color="green" size="xs" data-testid="diff-added">
            +{addedCount} added
          </Badge>
        )}
        {removedCount > 0 && (
          <Badge color="red" size="xs" data-testid="diff-removed">
            -{removedCount} removed
          </Badge>
        )}
        {changedCount > 0 && (
          <Badge color="amber" size="xs" data-testid="diff-changed">
            ~{changedCount} changed
          </Badge>
        )}
        {!delta && (
          <Badge color="gray" size="xs">
            No changes
          </Badge>
        )}
        <SegmentedControl
          size="xs"
          value={viewMode}
          onChange={(v) => setViewMode(v as RunDiffViewMode)}
          data={[
            { label: "Unified", value: "unified" },
            { label: "Split", value: "split" },
          ]}
          ml="auto"
        />
      </Group>

      {/* Unified view */}
      {viewMode === "unified" && (
        <Paper p="sm" withBorder>
          {lines.length === 0 ? (
            <Text size="xs" c="dimmed">Responses are identical.</Text>
          ) : (
            <Stack gap={6}>
              {lines.map((line, i) => (
                <DiffRow key={i} line={line} />
              ))}
            </Stack>
          )}
        </Paper>
      )}

      {/* Split view */}
      {viewMode === "split" && (
        <Group gap="sm" align="flex-start" wrap="nowrap">
          <Box style={{ flex: 1, minWidth: 0 }}>
            <Text size="xs" c="dimmed" mb={4}>Previous</Text>
            <Code block style={{ fontSize: "var(--mantine-font-size-xs)", maxHeight: "40vh", overflow: "auto" }}>
              {leftJson}
            </Code>
          </Box>
          <Box style={{ flex: 1, minWidth: 0 }}>
            <Text size="xs" c="dimmed" mb={4}>Current</Text>
            <Code block style={{ fontSize: "var(--mantine-font-size-xs)", maxHeight: "40vh", overflow: "auto" }}>
              {rightJson}
            </Code>
          </Box>
        </Group>
      )}
    </Stack>
  );
}
