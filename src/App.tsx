// src/App.tsx
import { useEffect, useState } from "react";
import { loadScenarios, saveScenarios, upsertScenario } from "./scenarios/storage";
import { PREBUILT_SCENARIOS } from "./scenarios/prebuilt";
import type { Scenario } from "./scenarios/types";
import { BlockCard } from "./components/BlockCard";
import { ContextPanel } from "./components/ContextPanel";
import { TopBar } from "./components/TopBar";
import { useRuntimeContext } from "./context/ContextStore";
import { useEnvironments } from "./environments/EnvironmentsStore";
import { runScenarioFrom } from "./execution/runScenario";
import {
  AppShell,
  Button,
  NavLink,
  Stack,
  Text,
} from "@mantine/core";

export function App() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const { context, dispatch } = useRuntimeContext();
  const { activeEnv } = useEnvironments();

  useEffect(() => {
    let loaded = loadScenarios();
    if (loaded.length === 0) {
      saveScenarios(PREBUILT_SCENARIOS);
      loaded = PREBUILT_SCENARIOS;
    }
    setScenarios(loaded);
    setActiveId(loaded[0]?.id ?? null);
  }, []);

  const active = scenarios.find((s) => s.id === activeId) ?? null;

  function updateActive(next: Scenario) {
    setScenarios((all) => all.map((s) => (s.id === next.id ? next : s)));
    upsertScenario(next);
  }

  async function runFrom(startIdx: number) {
    if (!active) return;
    await runScenarioFrom(active.blocks, startIdx, context, (newCtx) => {
      dispatch({ type: "MERGE", values: newCtx });
    }, activeEnv);
  }

  function importScenario(s: Scenario) {
    setScenarios((all) => [...all, s]);
    upsertScenario(s);
    setActiveId(s.id);
  }

  return (
    <AppShell
      navbar={{ width: 240, breakpoint: "sm" }}
      aside={{ width: 320, breakpoint: "md" }}
      header={{ height: 60 }}
      padding="md"
    >
      <AppShell.Header>
        <TopBar active={active} onRunAll={() => runFrom(0)} onImport={importScenario} />
      </AppShell.Header>

      <AppShell.Navbar p="md">
        <Stack gap="xs">
          <Button
            variant="default"
            size="xs"
            fullWidth
            onClick={() => {
              saveScenarios(PREBUILT_SCENARIOS);
              setScenarios(PREBUILT_SCENARIOS);
              setActiveId(PREBUILT_SCENARIOS[0]?.id ?? null);
            }}
          >
            Reset to prebuilt
          </Button>

          <Text size="xs" tt="uppercase" c="dimmed" fw={600} mt="xs">
            Scenarios
          </Text>

          {scenarios.map((s) => (
            <NavLink
              key={s.id}
              label={s.name}
              active={s.id === activeId}
              onClick={() => setActiveId(s.id)}
              style={{ borderRadius: "var(--mantine-radius-md)" }}
            />
          ))}
        </Stack>
      </AppShell.Navbar>

      <AppShell.Aside p="md">
        <Stack gap="xs">
          <Text size="xs" tt="uppercase" c="dimmed" fw={600}>
            Context
          </Text>
          <ContextPanel />
        </Stack>
      </AppShell.Aside>

      <AppShell.Main>
        <Stack gap="md">
          {active ? (
            active.blocks.map((b, i) => (
              <BlockCard
                key={b.id}
                block={b}
                onChange={(next) => {
                  const updatedBlocks = [...active.blocks];
                  updatedBlocks[i] = next;
                  updateActive({ ...active, blocks: updatedBlocks });
                }}
                onRunFromHere={() => runFrom(i)}
              />
            ))
          ) : (
            <Text c="dimmed">Select a scenario from the left.</Text>
          )}
        </Stack>
      </AppShell.Main>
    </AppShell>
  );
}
