// src/components/BurstDrawer.tsx
import { useEffect, useRef, useState } from "react";
import {
  Accordion,
  Alert,
  Badge,
  Box,
  Button,
  Drawer,
  Group,
  NumberInput,
  Paper,
  Progress,
  SegmentedControl,
  Switch,
  Text,
  Title,
} from "@mantine/core";
import type { BurstDeps, BurstOptions, BurstProgress, BurstRunResult, BurstSummary } from "../execution/burst";
import { runBurst } from "../execution/burst";
import type { Scenario } from "../scenarios/types";
import { STATUS_COLOR_BADGE } from "./BlockCard";
import { BurstTimeline } from "./BurstTimeline";
import type { TickState } from "./BurstTimeline";
import { BurstResultsSummary, RunDrillDown } from "./BurstResultsSummary";

// ─── Types ────────────────────────────────────────────────────────────────────

type Stage =
  | { kind: "config"; values: BurstOptions }
  | {
      kind: "running";
      values: BurstOptions;
      runs: BurstRunResult[];
      tickStates: TickState[];
      startedAt: number;
      controller: AbortController;
    }
  | { kind: "results"; values: BurstOptions; summary: BurstSummary; selectedRunIdx: number | null };

const DEFAULT_OPTIONS: BurstOptions = {
  count: 10,
  windowMs: 1000,
  concurrency: "sequential",
  freshContext: true,
};

type Props = {
  opened: boolean;
  onClose: () => void;
  scenario: Scenario | null;
  deps: Omit<BurstDeps, "scenario"> | null;
};

// ─── Main component ───────────────────────────────────────────────────────────

export function BurstDrawer({ opened, onClose, scenario, deps }: Props) {
  const [stage, setStage] = useState<Stage>({ kind: "config", values: DEFAULT_OPTIONS });
  const burstPromiseRef = useRef<Promise<void> | null>(null);

  // Abort on unmount while running
  useEffect(() => {
    return () => {
      if (stage.kind === "running") {
        stage.controller.abort();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleClose() {
    if (stage.kind === "running") {
      const ok = window.confirm("Cancel burst run?");
      if (!ok) return;
      stage.controller.abort();
    }
    onClose();
  }

  // ── Stage 1: Config ──

  function updateValues(patch: Partial<BurstOptions>) {
    if (stage.kind !== "config") return;
    setStage({ ...stage, values: { ...stage.values, ...patch } });
  }

  function startBurst() {
    if (!scenario || !deps) return;
    const values = (stage as { values: BurstOptions }).values;
    if (values.count < 1) return;

    const tickStates: TickState[] = Array.from({ length: values.count }, () => "pending");
    const controller = new AbortController();
    const startedAt = performance.now();
    const runs: BurstRunResult[] = [];

    setStage({ kind: "running", values, runs: [], tickStates, startedAt, controller });

    function onProgress(ev: BurstProgress) {
      if (ev.type === "run-started") {
        setStage((prev) => {
          if (prev.kind !== "running") return prev;
          const next = [...prev.tickStates];
          next[ev.runIdx] = "running";
          return { ...prev, tickStates: next };
        });
      } else if (ev.type === "run-finished") {
        const result = ev.result;
        setStage((prev) => {
          if (prev.kind !== "running") return prev;
          const next = [...prev.tickStates];
          next[result.runIdx] = result.status;
          return { ...prev, tickStates: next, runs: [...prev.runs, result] };
        });
        runs.push(result);
      } else if (ev.type === "done") {
        setStage({ kind: "results", values, summary: ev.summary, selectedRunIdx: null });
      }
    }

    const promise = runBurst(
      values,
      { scenario, ...deps },
      onProgress,
      controller.signal,
    ).then(() => {}).catch(() => {});

    burstPromiseRef.current = promise;
  }

  // ── Stage 2: Running ──

  function cancelBurst() {
    if (stage.kind !== "running") return;
    stage.controller.abort();
  }

  // ── Stage 3: Results ──

  function exportJson() {
    if (stage.kind !== "results") return;
    const ts = Date.now();
    const name = scenario?.name ?? "unknown";
    const blob = new Blob([JSON.stringify(stage.summary, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `burst-${name}-${ts}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function resetToConfig() {
    if (stage.kind !== "results") return;
    setStage({ kind: "config", values: stage.values });
  }

  function selectRun(idx: number) {
    if (stage.kind !== "results") return;
    setStage({ ...stage, selectedRunIdx: stage.selectedRunIdx === idx ? null : idx });
  }

  // ── Render body ──

  let body: React.ReactNode;

  if (!scenario || !deps) {
    body = (
      <Alert color="amber" variant="light" mt="md">
        No scenario selected. Open a scenario before running a burst.
      </Alert>
    );
  } else if (stage.kind === "config") {
    const { values } = stage;
    const isParallel = values.concurrency === "parallel";

    body = (
      <Box>
        <Group grow align="flex-start" mb="md">
          <Box>
            <NumberInput
              label="Count"
              value={values.count}
              onChange={(v) => updateValues({ count: typeof v === "number" ? v : parseInt(String(v)) || 1 })}
              min={1}
              max={200}
            />
            <Text size="xs" c="dimmed" mt={4}>max 200 runs</Text>
          </Box>
          <Box>
            <NumberInput
              label="Window (ms)"
              value={values.windowMs}
              onChange={(v) => updateValues({ windowMs: typeof v === "number" ? v : parseInt(String(v)) || 1000 })}
              min={50}
              max={60000}
              step={50}
            />
            <Text size="xs" c="dimmed" mt={4}>min 50ms · spread across this window</Text>
          </Box>
        </Group>

        <Box mb="md">
          <Text size="sm" fw={500} mb={6}>Concurrency</Text>
          <SegmentedControl
            value={values.concurrency}
            onChange={(v) => updateValues({ concurrency: v as "sequential" | "parallel" })}
            data={[
              { label: "Sequential", value: "sequential" },
              { label: "Parallel", value: "parallel" },
            ]}
          />
        </Box>

        <Box mb="xl">
          <Switch
            label="Fresh context per run"
            checked={isParallel ? true : values.freshContext}
            disabled={isParallel}
            onChange={(e) => updateValues({ freshContext: e.currentTarget.checked })}
          />
          {isParallel && (
            <Text size="xs" c="dimmed" mt={4}>
              Parallel forces fresh context to avoid race conditions.
            </Text>
          )}
        </Box>

        <Group>
          <Button onClick={startBurst}>Start burst</Button>
          <Button variant="subtle" onClick={onClose}>Cancel</Button>
        </Group>
      </Box>
    );
  } else if (stage.kind === "running") {
    const { tickStates, values } = stage;
    const doneCount = tickStates.filter((s) => s === "ok" || s === "err").length;
    const okCount = tickStates.filter((s) => s === "ok").length;
    const errCount = tickStates.filter((s) => s === "err").length;
    const runningCount = tickStates.filter((s) => s === "running").length;
    const pendingCount = tickStates.filter((s) => s === "pending").length;

    body = (
      <Box>
        <Progress value={(doneCount / values.count) * 100} mb="sm" />
        <Group gap="sm" mb="md">
          <Badge color={STATUS_COLOR_BADGE["idle"]}>{pendingCount} pending</Badge>
          <Badge color={STATUS_COLOR_BADGE["running"]}>{runningCount} running</Badge>
          <Badge color={STATUS_COLOR_BADGE["ok"]}>{okCount} ok</Badge>
          <Badge color={STATUS_COLOR_BADGE["err"]}>{errCount} err</Badge>
        </Group>
        <BurstTimeline tickStates={tickStates} />
        <Group mt="xl">
          <Button color="coral" variant="default" onClick={cancelBurst}>Cancel</Button>
        </Group>
      </Box>
    );
  } else {
    // results
    const { summary, selectedRunIdx } = stage;
    const { errCount, errorGroups, runs } = summary;
    const allTicks: TickState[] = runs
      .slice()
      .sort((a, b) => a.runIdx - b.runIdx)
      .map((r) => r.status);

    const selectedRun = selectedRunIdx !== null ? runs.find((r) => r.runIdx === selectedRunIdx) ?? null : null;

    body = (
      <Box>
        <BurstResultsSummary scenarioName={scenario.name} summary={summary} />

        <BurstTimeline
          tickStates={allTicks}
          selectedIdx={selectedRunIdx}
          onSelect={selectRun}
        />

        {errCount > 0 && errorGroups.length > 0 && (
          <Accordion variant="contained" mt="md">
            {errorGroups.map((grp, i) => (
              <Accordion.Item key={i} value={String(i)}>
                <Accordion.Control>
                  <Group gap="sm">
                    <Badge color="coral">{grp.count}×</Badge>
                    <Text size="sm" truncate style={{ maxWidth: 360 }}>{grp.message}</Text>
                  </Group>
                </Accordion.Control>
                <Accordion.Panel>
                  <Text size="sm" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                    {grp.message}
                  </Text>
                </Accordion.Panel>
              </Accordion.Item>
            ))}
          </Accordion>
        )}

        {selectedRun && (
          <Paper withBorder p="md" mt="md" radius="md">
            <Text fw={600} mb="sm">Run #{selectedRun.runIdx + 1}</Text>
            <RunDrillDown run={selectedRun} registry={deps.registry} scenarioBlocks={scenario.blocks} />
          </Paper>
        )}

        <Group mt="xl">
          <Button variant="default" onClick={exportJson}>Export JSON</Button>
          <Button variant="default" onClick={resetToConfig}>Run again</Button>
          <Button variant="subtle" onClick={onClose}>Close</Button>
        </Group>
      </Box>
    );
  }

  return (
    <Drawer
      opened={opened}
      onClose={handleClose}
      position="right"
      size="lg"
      title={<Title order={5}>Burst: {scenario?.name ?? "—"}</Title>}
      closeOnEscape={stage.kind !== "running"}
      closeOnClickOutside={stage.kind !== "running"}
    >
      {body}
    </Drawer>
  );
}
