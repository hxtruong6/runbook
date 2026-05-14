// src/components/BurstResultsSummary.tsx
import { useReducer, useState } from "react";
import { Badge, Box, Button, Group, Paper, SegmentedControl, SimpleGrid, Stack, Table, Text } from "@mantine/core";
import type { BurstRunResult, BurstSummary } from "../execution/burst";
import type { BlockRunResult, BlockInstance } from "../blocks/types";
import { ResponseViewer } from "./ResponseViewer";
import { STATUS_COLOR_BADGE } from "./BlockCard";

function fmt(ms: number): string {
  return `${Math.round(ms)}ms`;
}

function StatBlock({ label, value }: { label: string; value: string | number }) {
  return (
    <Box ta="center">
      <Text fw={700} size="lg" lh={1.2}>{value}</Text>
      <Text size="xs" c="dimmed">{label}</Text>
    </Box>
  );
}

type SummaryProps = {
  scenarioName: string;
  summary: BurstSummary;
};

export function BurstResultsSummary({ scenarioName, summary }: SummaryProps) {
  const { latencies, okCount, errCount, totalElapsedMs, runs } = summary;
  const errRate = runs.length > 0 ? ((errCount / runs.length) * 100).toFixed(1) : "0.0";

  return (
    <Paper withBorder p="md" mb="md" radius="md">
      <Text mb="md">
        <Text span fw={600}>{scenarioName}</Text>
        {" · total elapsed: "}<Text span fw={600}>{fmt(totalElapsedMs)}</Text>
      </Text>
      <SimpleGrid cols={4} mb="sm">
        <StatBlock label="Runs" value={runs.length} />
        <StatBlock label="OK" value={okCount} />
        <StatBlock label="p50" value={fmt(latencies.p50)} />
        <StatBlock label="p95" value={fmt(latencies.p95)} />
      </SimpleGrid>
      <SimpleGrid cols={4}>
        <StatBlock label="Max" value={fmt(latencies.max)} />
        <StatBlock label="Mean" value={fmt(latencies.mean)} />
        <StatBlock label="Error rate %" value={`${errRate}%`} />
        <StatBlock label="Total ms" value={fmt(totalElapsedMs)} />
      </SimpleGrid>
    </Paper>
  );
}

type WaterfallProps = {
  results: BlockRunResult[];
  scenarioBlocks?: BlockInstance[];
  registry: Record<string, { label?: string }>;
};

function WaterfallChart({ results, scenarioBlocks, registry }: WaterfallProps) {
  const totalMs = results.reduce((sum, r) => sum + r.elapsedMs, 0);

  return (
    <Box>
      {results.map((result, idx) => {
        const block = scenarioBlocks?.[idx];
        const label = registry[block?.kind ?? ""]?.label ?? block?.kind ?? `Block ${idx + 1}`;
        const widthPct = totalMs > 0 ? (result.elapsedMs / totalMs) * 100 : 0;
        const barColor =
          result.status === "ok"
            ? "var(--mantine-color-teal-5)"
            : "var(--mantine-color-red-5)";

        return (
          <Group key={idx} gap="xs" wrap="nowrap" mb={4}>
            <Text size="xs" w={120} truncate="end">{label}</Text>
            <Box style={{ flex: 1 }}>
              <Box
                h={16}
                style={{
                  width: `${Math.max(widthPct, 1)}%`,
                  backgroundColor: barColor,
                  borderRadius: 2,
                }}
              />
            </Box>
            <Text size="xs" c="dimmed" w={60} ta="right">{result.elapsedMs}ms</Text>
          </Group>
        );
      })}
    </Box>
  );
}

type DrillDownProps = {
  run: BurstRunResult;
  registry: Record<string, { label?: string }>;
  scenarioBlocks?: BlockInstance[];
};

export function RunDrillDown({ run, registry, scenarioBlocks }: DrillDownProps) {
  const [expandedIdx, setExpandedIdx] = useReducer(
    (state: number | null, idx: number) => (state === idx ? null : idx),
    null,
  );
  const [view, setView] = useState<"table" | "waterfall">("table");

  return (
    <Stack gap="xs">
      <SegmentedControl
        size="xs"
        value={view}
        onChange={(v) => setView(v as "table" | "waterfall")}
        data={[{ label: "Table", value: "table" }, { label: "Waterfall", value: "waterfall" }]}
      />
      {view === "table" ? (
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Status</Table.Th>
              <Table.Th>Block</Table.Th>
              <Table.Th>Elapsed</Table.Th>
              <Table.Th></Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {run.blockResults.map((br, idx) => {
              const block = scenarioBlocks?.[idx];
              const label = registry[block?.kind ?? ""]?.label ?? block?.kind ?? `Block ${idx + 1}`;
              const expanded = expandedIdx === idx;
              return (
                <>
                  <Table.Tr key={idx}>
                    <Table.Td>
                      <Badge color={STATUS_COLOR_BADGE[br.status]} variant="light" size="sm">
                        {br.status}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{label}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" c="dimmed">{fmt(br.elapsedMs)}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Button
                        size="xs"
                        variant="subtle"
                        onClick={() => setExpandedIdx(idx)}
                      >
                        {expanded ? "Hide" : "View"}
                      </Button>
                    </Table.Td>
                  </Table.Tr>
                  {expanded && (
                    <Table.Tr key={`${idx}-detail`}>
                      <Table.Td colSpan={4}>
                        <ResponseViewer result={br as BlockRunResult} />
                      </Table.Td>
                    </Table.Tr>
                  )}
                </>
              );
            })}
          </Table.Tbody>
        </Table>
      ) : (
        <WaterfallChart results={run.blockResults} scenarioBlocks={scenarioBlocks} registry={registry} />
      )}
    </Stack>
  );
}
