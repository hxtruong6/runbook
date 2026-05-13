// src/App.tsx
import { useEffect, useMemo, useState } from "react";
import { BurstDrawer } from "./components/BurstDrawer";
import { makeInitialContext } from "./context/ContextStore";
import { loadScenarios, saveScenarios, upsertScenario } from "./scenarios/storage";
import { PREBUILT_SCENARIOS } from "./scenarios/prebuilt";
import type { Scenario } from "./scenarios/types";
import { AddBlockMenu } from "./components/AddBlockMenu";
import { BlockCard } from "./components/BlockCard";
import { ContextPanel } from "./components/ContextPanel";
import { TopBar } from "./components/TopBar";
import { ProjectSwitcher } from "./components/ProjectSwitcher";
import { WhatsNewPanel } from "./components/WhatsNewPanel";
import { useRuntimeContext } from "./context/ContextStore";
import { useEnvironments } from "./environments/EnvironmentsStore";
import { runScenarioFrom } from "./execution/runScenario";
import { buildRegistry } from "./blocks";
import { getBaseUrl } from "./api/config";
import { RegistryProvider } from "./blocks/RegistryContext";
import { useProjects } from "./projects/ProjectsStore";
import { SCENARIO_REF_KIND } from "./blocks/scenarioRef";
import {
  Accordion,
  AppShell,
  Badge,
  Button,
  Divider,
  Group,
  NavLink,
  SegmentedControl,
  Stack,
  Text,
  ThemeIcon,
} from "@mantine/core";
import { IconPlus, IconClipboardList } from "@tabler/icons-react";

export function App() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const { context, dispatch } = useRuntimeContext();
  const { activeEnv } = useEnvironments();
  const { activeProject, activeVersion } = useProjects();
  const [view, setView] = useState<"blocks" | "whatsnew">("blocks");
  const [insertAfterIdx, setInsertAfterIdx] = useState<number | null>(null);
  const [burstOpen, setBurstOpen] = useState(false);

  // Reset view when active project changes
  useEffect(() => {
    setView("blocks");
  }, [activeProject?.id]);

  const registry = useMemo(
    () => buildRegistry(activeVersion?.blocks ?? [], getBaseUrl),
    [activeVersion]
  );

  useEffect(() => {
    let loaded = loadScenarios();
    if (loaded.length === 0) {
      saveScenarios(PREBUILT_SCENARIOS);
      loaded = PREBUILT_SCENARIOS;
    }
    setScenarios(loaded);
    setActiveId(loaded[0]?.id ?? null);
  }, []);

  // When a project is active, use its version's scenarios; otherwise local state
  const displayScenarios = activeProject
    ? (activeVersion?.scenarios ?? [])
    : scenarios;

  const burstDeps = useMemo(() => ({
    scenarioLookup: (id: string) => displayScenarios.find(s => s.id === id) ?? null,
    registry,
    env: activeEnv ?? null,
    makeCtx: makeInitialContext,
  }), [displayScenarios, registry, activeEnv]);

  const active = displayScenarios.find((s) => s.id === activeId) ?? null;

  function updateActive(next: Scenario) {
    if (activeProject) return; // read-only when project is active
    setScenarios((all) => all.map((s) => (s.id === next.id ? next : s)));
    upsertScenario(next);
  }

  async function runFrom(startIdx: number) {
    if (!active) return;
    await runScenarioFrom(active.blocks, startIdx, context, (newCtx) => {
      dispatch({ type: "MERGE", values: newCtx });
    }, activeEnv, registry);
  }

  function importScenario(s: Scenario) {
    if (activeProject) return; // read-only when project is active
    setScenarios((all) => [...all, s]);
    upsertScenario(s);
    setActiveId(s.id);
  }

  return (
    <RegistryProvider registry={registry}>
      <AppShell
        navbar={{ width: 240, breakpoint: "sm" }}
        aside={{ width: 320, breakpoint: "md" }}
        header={{ height: 60 }}
        padding="md"
      >
        <AppShell.Header>
          <TopBar
            active={active}
            onRunAll={() => runFrom(0)}
            onImport={importScenario}
            onBurst={() => setBurstOpen(true)}
            onDuplicate={(s) => {
              if (activeProject) return;
              const duped = { ...s, id: crypto.randomUUID(), name: s.name + " (copy)", createdAt: new Date().toISOString() };
              setScenarios((all) => [...all, duped]);
              upsertScenario(duped);
              setActiveId(duped.id);
            }}
            onToggleReusable={() => {
              if (!active || activeProject) return;
              updateActive({ ...active, reusable: !active.reusable });
            }}
          />
        </AppShell.Header>

        <AppShell.Navbar p="md">
          <Stack gap="xs">
            <ProjectSwitcher />
            <Divider my="sm" />
            <Button
              variant="default"
              size="xs"
              fullWidth
              disabled={!!activeProject}
              onClick={() => {
                if (activeProject) return;
                saveScenarios(PREBUILT_SCENARIOS);
                setScenarios(PREBUILT_SCENARIOS);
                setActiveId(PREBUILT_SCENARIOS[0]?.id ?? null);
              }}
            >
              Reset to prebuilt
            </Button>

            {activeProject && (
              <Text size="xs" c="dimmed" mb="xs">
                Read-only — defined by project version
              </Text>
            )}

            <Text size="xs" tt="uppercase" c="dimmed" fw={600} mt="xs">
              Scenarios
            </Text>

            <Accordion variant="filled" multiple defaultValue={["flows", "reusable"]}>
              <Accordion.Item value="flows">
                <Accordion.Control>
                  <Text size="sm" fw={500}>
                    Flows{" "}
                    <Text span size="xs" c="dimmed">
                      ({displayScenarios.filter((s) => !s.reusable).length})
                    </Text>
                  </Text>
                </Accordion.Control>
                <Accordion.Panel>
                  {displayScenarios.filter((s) => !s.reusable).length === 0 ? (
                    <Text size="xs" c="dimmed" pl="xs">No flow scenarios yet</Text>
                  ) : (
                    displayScenarios.filter((s) => !s.reusable).map((s) => (
                      <NavLink
                        key={s.id}
                        label={s.name}
                        active={s.id === activeId}
                        onClick={() => setActiveId(s.id)}
                        style={{ borderRadius: "var(--mantine-radius-md)" }}
                      />
                    ))
                  )}
                </Accordion.Panel>
              </Accordion.Item>

              <Accordion.Item value="reusable">
                <Accordion.Control>
                  <Text size="sm" fw={500}>
                    Reusable{" "}
                    <Text span size="xs" c="dimmed">
                      ({displayScenarios.filter((s) => s.reusable).length})
                    </Text>
                  </Text>
                </Accordion.Control>
                <Accordion.Panel>
                  {displayScenarios.filter((s) => s.reusable).length === 0 ? (
                    <Text size="xs" c="dimmed" pl="xs">No reusable scenarios yet</Text>
                  ) : (
                    displayScenarios.filter((s) => s.reusable).map((s) => {
                      const usedByCount = displayScenarios.reduce((count, other) => {
                        return count + other.blocks.filter(
                          (b) => b.kind === SCENARIO_REF_KIND &&
                            (b.overrides as { scenarioId?: string }).scenarioId === s.id
                        ).length;
                      }, 0);
                      return (
                        <div key={s.id}>
                          <NavLink
                            label={s.name}
                            active={s.id === activeId}
                            onClick={() => setActiveId(s.id)}
                            style={{ borderRadius: "var(--mantine-radius-md)" }}
                            rightSection={
                              <Badge size="xs" variant="light" color="violet">ref</Badge>
                            }
                          />
                          <Text
                            size="xs"
                            c={usedByCount === 0 ? "dimmed" : "dimmed"}
                            pl="md"
                            style={{ opacity: usedByCount === 0 ? 0.5 : 1 }}
                          >
                            {usedByCount === 0 ? "unused" : `Used by ${usedByCount}`}
                          </Text>
                        </div>
                      );
                    })
                  )}
                </Accordion.Panel>
              </Accordion.Item>
            </Accordion>

            <Button
              variant="subtle"
              size="xs"
              leftSection={<IconPlus size={14} />}
              fullWidth
              disabled={!!activeProject}
              onClick={() => {
                if (activeProject) return;
                const newId = crypto.randomUUID();
                const newScenario: Scenario = {
                  id: newId,
                  name: "Untitled scenario",
                  createdAt: new Date().toISOString(),
                  blocks: [],
                  reusable: false,
                };
                setScenarios((all) => [...all, newScenario]);
                upsertScenario(newScenario);
                setActiveId(newId);
              }}
            >
              New scenario
            </Button>
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
          <Group justify="space-between" mb="md">
            <SegmentedControl
              size="xs"
              w={240}
              value={view}
              onChange={(v) => setView(v as "blocks" | "whatsnew")}
              data={[
                { label: "Blocks", value: "blocks" },
                {
                  label: `What's new${(activeVersion?.changes.length ?? 0) > 0 ? ` (${activeVersion!.changes.length})` : ""}`,
                  value: "whatsnew",
                },
              ]}
            />
          </Group>

          {view === "whatsnew" ? (
            <WhatsNewPanel />
          ) : (
            <Stack gap="md">
              {active ? (
                <>
                  {active.blocks.map((b, i) => (
                    <div key={b.id}>
                      <BlockCard
                        block={b}
                        scenarios={displayScenarios}
                        onChange={(next) => {
                          if (activeProject) return;
                          const updatedBlocks = [...active.blocks];
                          updatedBlocks[i] = next;
                          updateActive({ ...active, blocks: updatedBlocks });
                        }}
                        onRunFromHere={() => runFrom(i)}
                        onDuplicate={activeProject ? undefined : () => {
                          const clone = { ...b, id: crypto.randomUUID() };
                          const updatedBlocks = [...active.blocks];
                          updatedBlocks.splice(i + 1, 0, clone);
                          updateActive({ ...active, blocks: updatedBlocks });
                        }}
                        onRemove={activeProject ? undefined : () => {
                          updateActive({ ...active, blocks: active.blocks.filter((_, idx) => idx !== i) });
                        }}
                        onInsertBelow={activeProject ? undefined : () => {
                          setInsertAfterIdx(i);
                        }}
                      />
                      {insertAfterIdx === i && !activeProject && (
                        <AddBlockMenu
                          onAdd={(instance) => {
                            const updatedBlocks = [...active.blocks];
                            updatedBlocks.splice(i + 1, 0, instance);
                            updateActive({ ...active, blocks: updatedBlocks });
                            setInsertAfterIdx(null);
                          }}
                          scenarios={displayScenarios.filter((s) => s.id !== active.id)}
                          currentScenarioId={active.id}
                        />
                      )}
                    </div>
                  ))}
                  {!activeProject && (
                    <AddBlockMenu
                      onAdd={(instance) => {
                        updateActive({ ...active, blocks: [...active.blocks, instance] });
                      }}
                      scenarios={displayScenarios.filter((s) => s.id !== active.id)}
                      currentScenarioId={active.id}
                    />
                  )}
                </>
              ) : (
                <Stack align="center" gap="xs" py="xl">
                  <ThemeIcon size={56} radius="xl" variant="light" color="gray">
                    <IconClipboardList size={28} />
                  </ThemeIcon>
                  <Text fw={600}>No scenario selected</Text>
                  <Text size="sm" c="dimmed" ta="center" maw={320}>
                    Pick a scenario from the sidebar, or create a new one to
                    get started.
                  </Text>
                </Stack>
              )}
            </Stack>
          )}
        </AppShell.Main>
      </AppShell>
      <BurstDrawer
        opened={burstOpen}
        onClose={() => setBurstOpen(false)}
        scenario={active}
        deps={active ? burstDeps : null}
      />
    </RegistryProvider>
  );
}
