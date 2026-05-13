// src/components/ScenarioRefCard.tsx
import { useState } from "react";
import {
  Accordion,
  ActionIcon,
  Alert,
  Badge,
  Button,
  Group,
  Menu,
  Paper,
  Switch,
  Text,
  Title,
} from "@mantine/core";
import type { BlockInstance, BlockRunResult } from "../blocks/types";
import type { Scenario } from "../scenarios/types";
import { SCENARIO_REF_KIND, parseScenarioRefOverrides } from "../blocks/scenarioRef";
import { useBlockRegistry } from "../blocks/RegistryContext";
import { useRuntimeContext } from "../context/ContextStore";
import { useEnvironments } from "../environments/EnvironmentsStore";
import { runScenarioFrom } from "../execution/runScenario";
import { ResponseViewer } from "./ResponseViewer";
import { STATUS_COLOR_BADGE } from "./BlockCard";

type Props = {
  block: BlockInstance;
  onChange: (next: BlockInstance) => void;
  scenarios: Scenario[];
  onRunFromHere?: () => void;
  onDuplicate?: () => void;
  onRemove?: () => void;
  onInsertBelow?: () => void;
};

export function ScenarioRefCard({
  block,
  onChange,
  scenarios,
  onRunFromHere,
  onDuplicate,
  onRemove,
  onInsertBelow,
}: Props) {
  const registry = useBlockRegistry();
  const { context, dispatch } = useRuntimeContext();
  const { activeEnv } = useEnvironments();
  const [result, setResult] = useState<BlockRunResult | null>(null);
  const [running, setRunning] = useState(false);

  // Parse overrides with fallback
  let scenarioId = "";
  let continueOnError = false;
  try {
    const parsed = parseScenarioRefOverrides(block.overrides);
    scenarioId = parsed.scenarioId;
    continueOnError = parsed.continueOnError ?? false;
  } catch {
    // will show error below
  }

  const referencedScenario = scenarios.find((s) => s.id === scenarioId) ?? null;
  const stepCount = referencedScenario?.blocks.length ?? 0;

  const status: "idle" | "running" | "ok" | "err" = running
    ? "running"
    : result?.status === "ok"
    ? "ok"
    : result?.status === "err"
    ? "err"
    : "idle";

  async function runThis() {
    setRunning(true);
    let lastResult: BlockRunResult | null = null;
    const scenarioLookup = (id: string) => scenarios.find((s) => s.id === id) ?? null;
    await runScenarioFrom(
      [block],
      0,
      context,
      (newCtx, _idx, r) => {
        lastResult = r;
        dispatch({ type: "MERGE", values: newCtx });
      },
      activeEnv,
      registry,
      scenarioLookup
    );
    setResult(lastResult);
    setRunning(false);
  }

  // Sub-block label summaries (first 3)
  const subBlockSummary = referencedScenario
    ? referencedScenario.blocks.slice(0, 3).map((b) => {
        if (b.kind === SCENARIO_REF_KIND) {
          const refOvr = b.overrides as { scenarioId?: string };
          const sub = scenarios.find((s) => s.id === refOvr.scenarioId);
          return sub ? sub.name : "scenario-ref";
        }
        const def = registry[b.kind];
        return def ? def.label : b.kind;
      })
    : [];
  const moreCount = referencedScenario ? Math.max(0, referencedScenario.blocks.length - 3) : 0;

  const subResults = result?.subResults;

  return (
    <Paper
      p="md"
      mb="sm"
      withBorder
      radius="md"
      shadow="xs"
      style={{ borderStyle: "dashed" }}
    >
      {/* Header */}
      <Group justify="space-between" mb="sm">
        <Group gap="sm">
          <Badge variant="light" color={STATUS_COLOR_BADGE[status]} size="sm">
            {status}
          </Badge>
          <Badge color="violet" variant="light" size="sm">
            scenario
          </Badge>
          {referencedScenario ? (
            <Title order={6} style={{ margin: 0 }}>
              {referencedScenario.name}
            </Title>
          ) : (
            <Title order={6} style={{ margin: 0, color: "var(--mantine-color-red-6)" }}>
              Missing scenario
            </Title>
          )}
        </Group>

        <Group gap="xs">
          {onRunFromHere && (
            <Button variant="default" size="xs" onClick={onRunFromHere}>
              Run from here
            </Button>
          )}
          <Button variant="filled" size="xs" loading={running} onClick={runThis}>
            Run
          </Button>
          <Menu shadow="md" width={180} position="bottom-end">
            <Menu.Target>
              <ActionIcon variant="subtle" size="sm" aria-label="Block actions">
                ⋮
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              {onRunFromHere && (
                <Menu.Item onClick={onRunFromHere}>Run from here</Menu.Item>
              )}
              {onDuplicate && <Menu.Item onClick={onDuplicate}>Duplicate</Menu.Item>}
              {onInsertBelow && <Menu.Item onClick={onInsertBelow}>Insert below…</Menu.Item>}
              {onRemove && (
                <>
                  <Menu.Divider />
                  <Menu.Item color="red" onClick={onRemove}>Remove</Menu.Item>
                </>
              )}
            </Menu.Dropdown>
          </Menu>
        </Group>
      </Group>

      {/* Body */}
      <Text size="sm" c="dimmed">
        {stepCount} {stepCount === 1 ? "step" : "steps"}
      </Text>

      {!result && referencedScenario && subBlockSummary.length > 0 && (
        <Text size="sm" c="dimmed" mt="xs">
          {subBlockSummary.join(" · ")}
          {moreCount > 0 ? ` … and ${moreCount} more` : ""}
        </Text>
      )}

      <Switch
        size="xs"
        label="continue on error"
        checked={continueOnError}
        mt="sm"
        onChange={(e) =>
          onChange({
            ...block,
            overrides: { ...block.overrides, continueOnError: e.currentTarget.checked },
          })
        }
      />

      {/* After-run: accordion of sub-results */}
      {result && (
        <>
          {subResults && subResults.length > 0 ? (
            <Accordion variant="separated" mt="sm">
              {subResults.map((sr, i) => {
                const subBlock = referencedScenario?.blocks[i];
                const subDef = subBlock ? registry[subBlock.kind] : undefined;
                const subLabel = subDef ? subDef.label : subBlock?.kind ?? `Step ${i + 1}`;
                const subStatus = sr.status;
                return (
                  <Accordion.Item key={i} value={String(i)}>
                    <Accordion.Control>
                      <Group gap="sm">
                        <Badge
                          variant="light"
                          color={STATUS_COLOR_BADGE[subStatus] ?? "gray"}
                          size="xs"
                        >
                          {subStatus}
                        </Badge>
                        <Text size="sm">{subLabel}</Text>
                      </Group>
                    </Accordion.Control>
                    <Accordion.Panel>
                      <ResponseViewer result={sr} />
                    </Accordion.Panel>
                  </Accordion.Item>
                );
              })}
            </Accordion>
          ) : (
            result.status === "err" && result.error && (
              <Alert color="red" variant="light" mt="sm">
                <Text size="xs">{result.error}</Text>
              </Alert>
            )
          )}
        </>
      )}
    </Paper>
  );
}
