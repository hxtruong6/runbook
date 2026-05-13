// src/App.tsx
import { useEffect, useMemo, useState } from "react";
import { BurstDrawer } from "./components/BurstDrawer";
import { makeInitialContext } from "./context/ContextStore";
import { loadScenarios, saveScenarios, upsertScenario, deleteScenario } from "./scenarios/storage";
import { PREBUILT_SCENARIOS } from "./scenarios/prebuilt";
import type { Scenario } from "./scenarios/types";
import { AddBlockMenu } from "./components/AddBlockMenu";
import { BlockCard } from "./components/BlockCard";
import { ContextPanel } from "./components/ContextPanel";
import { TopBar } from "./components/TopBar";
import { ProjectSwitcher } from "./components/ProjectSwitcher";
import { WhatsNewPanel } from "./components/WhatsNewPanel";
import { BlockDefsPanel } from "./components/BlockDefsPanel";
import { SchemaDocsPanel } from "./components/SchemaDocsPanel";
import { useRuntimeContext } from "./context/ContextStore";
import { useEnvironments } from "./environments/EnvironmentsStore";
import { runScenarioFrom } from "./execution/runScenario";
import { buildRegistry } from "./blocks";
import { getBaseUrl } from "./api/config";
import { RegistryProvider } from "./blocks/RegistryContext";
import { useProjects } from "./projects/ProjectsStore";
import { loadLocalBlocks, upsertLocalBlock, deleteLocalBlock } from "./blocks/localBlocksStore";
import type { BlockDefData } from "./blocks/dataBlock";
import {
  ActionIcon,
  AppShell,
  Badge,
  Button,
  Divider,
  Group,
  Menu,
  NavLink,
  SegmentedControl,
  ScrollArea,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
} from "@mantine/core";
import { modals, openConfirmModal } from "@mantine/modals";
import { IconPlus, IconClipboardList, IconDots } from "@tabler/icons-react";
import { GraphCanvas } from "./components/GraphCanvas";
import { runGraph } from "./graph/runner";
import type { GraphData } from "./graph/types";

export function App() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const { context, dispatch } = useRuntimeContext();
  const { activeEnv } = useEnvironments();
  const { activeProject, activeVersion } = useProjects();
  const [localBlocks, setLocalBlocks] = useState<BlockDefData[]>(() => loadLocalBlocks());
  const [view, setView] = useState<"blocks" | "whatsnew" | "apis" | "schema">("blocks");
  const [insertAfterIdx, setInsertAfterIdx] = useState<number | null>(null);
  const [burstOpen, setBurstOpen] = useState(false);
  const [graphMode, setGraphMode] = useState<Record<string, "list" | "graph">>({});

  // Reset view when active project changes
  useEffect(() => {
    setView("blocks");
  }, [activeProject?.id]);

  const registry = useMemo(
    () => buildRegistry([...localBlocks, ...(activeVersion?.blocks ?? [])], getBaseUrl),
    [activeVersion, localBlocks]
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
  const activeMode = active ? (graphMode[active.id] ?? (active.graphData ? "graph" : "list")) : "list";

  function updateActive(next: Scenario) {
    if (activeProject) return; // read-only when project is active
    setScenarios((all) => all.map((s) => (s.id === next.id ? next : s)));
    upsertScenario(next);
  }

  async function runFrom(startIdx: number) {
    if (!active) return;
    if (activeMode === "graph" && active.graphData) {
      await runGraph(
        active.graphData,
        context,
        (newCtx) => { dispatch({ type: "MERGE", values: newCtx }); },
        activeEnv,
        registry,
        (id) => displayScenarios.find((s) => s.id === id) ?? null,
      );
    } else {
      await runScenarioFrom(active.blocks, startIdx, context, (newCtx) => {
        dispatch({ type: "MERGE", values: newCtx });
      }, activeEnv, registry);
    }
  }

  function importScenario(s: Scenario) {
    if (activeProject) return; // read-only when project is active
    setScenarios((all) => [...all, s]);
    upsertScenario(s);
    setActiveId(s.id);
  }

  function openRenameModal(scenario: Scenario) {
    let newName = scenario.name;
    modals.open({
      title: "Rename scenario",
      children: (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const trimmed = newName.trim();
            if (trimmed) {
              const updated = { ...scenario, name: trimmed };
              setScenarios((all) => all.map((s) => (s.id === updated.id ? updated : s)));
              upsertScenario(updated);
            }
            modals.closeAll();
          }}
        >
          <TextInput
            defaultValue={scenario.name}
            onChange={(e) => { newName = e.currentTarget.value; }}
            data-autofocus
            mb="sm"
          />
          <Button type="submit" size="sm" fullWidth>Save</Button>
        </form>
      ),
    });
  }

  function openDeleteModal(scenario: Scenario) {
    openConfirmModal({
      title: "Delete scenario",
      children: (
        <Text size="sm">Delete &ldquo;{scenario.name}&rdquo;? This cannot be undone.</Text>
      ),
      labels: { confirm: "Delete", cancel: "Cancel" },
      confirmProps: { color: "red" },
      onConfirm: () => {
        setScenarios((all) => all.filter((s) => s.id !== scenario.id));
        deleteScenario(scenario.id);
        if (activeId === scenario.id) {
          setActiveId(scenarios.find((s) => s.id !== scenario.id)?.id ?? null);
        }
      },
    });
  }

  function enableGraphMode(scenario: Scenario) {
    if (scenario.graphData) {
      setGraphMode((m) => ({ ...m, [scenario.id]: "graph" }));
      return;
    }
    const startId = crypto.randomUUID();
    const initialGraphData: GraphData = {
      startNodeId: startId,
      nodes: scenario.blocks.map((b, i) => ({
        blockInstance: b,
        name: b.kind,
        position: { x: 200, y: 80 + i * 120 },
      })).concat([{
        blockInstance: { id: startId, kind: "start", overrides: {} },
        name: "Start",
        position: { x: 200, y: 0 },
      }]),
      edges: [],
    };
    const updated = { ...scenario, graphData: initialGraphData };
    updateActive(updated);
    setGraphMode((m) => ({ ...m, [scenario.id]: "graph" }));
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

        <AppShell.Navbar p="md" style={{ display: "flex", flexDirection: "column" }}>
          <Stack gap="xs" style={{ flexShrink: 0 }}>
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
              <Text size="xs" c="dimmed">
                Read-only — defined by project version
              </Text>
            )}

            <Group justify="space-between" mt="xs">
              <Text size="xs" tt="uppercase" c="dimmed" fw={600}>
                Scenarios
              </Text>
              <Text size="xs" c="dimmed">{displayScenarios.length}</Text>
            </Group>
          </Stack>

          <ScrollArea style={{ flex: 1, minHeight: 0 }} mt="xs">
            <Stack gap={2}>
              {displayScenarios.length === 0 ? (
                <Text size="xs" c="dimmed" pl="xs">No scenarios yet</Text>
              ) : (
                displayScenarios.map((s) => (
                  <NavLink
                    key={s.id}
                    label={s.name}
                    active={s.id === activeId}
                    onClick={() => setActiveId(s.id)}
                    style={{ borderRadius: "var(--mantine-radius-md)" }}
                    rightSection={
                      <Group gap={4} wrap="nowrap">
                        {s.reusable && (
                          <Badge size="xs" variant="light" color="teal">reusable</Badge>
                        )}
                        {!activeProject && (
                          <Menu position="right-start" withinPortal>
                            <Menu.Target>
                              <ActionIcon
                                size="xs"
                                variant="subtle"
                                aria-label="Scenario options"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <IconDots size={12} />
                              </ActionIcon>
                            </Menu.Target>
                            <Menu.Dropdown>
                              <Menu.Item onClick={(e) => { e.stopPropagation(); openRenameModal(s); }}>
                                Rename
                              </Menu.Item>
                              <Menu.Item onClick={(e) => {
                                e.stopPropagation();
                                const updated = { ...s, reusable: !s.reusable };
                                setScenarios((all) => all.map((sc) => sc.id === s.id ? updated : sc));
                                upsertScenario(updated);
                              }}>
                                {s.reusable ? "Make a flow" : "Make reusable"}
                              </Menu.Item>
                              <Menu.Item color="red" onClick={(e) => { e.stopPropagation(); openDeleteModal(s); }}>
                                Delete
                              </Menu.Item>
                            </Menu.Dropdown>
                          </Menu>
                        )}
                      </Group>
                    }
                  />
                ))
              )}
            </Stack>
          </ScrollArea>

          <Button
            variant="subtle"
            size="xs"
            leftSection={<IconPlus size={14} />}
            fullWidth
            disabled={!!activeProject}
            mt="xs"
            style={{ flexShrink: 0 }}
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
              value={view}
              onChange={(v) => setView(v as "blocks" | "whatsnew" | "apis" | "schema")}
              data={[
                { label: "Scenarios", value: "blocks" },
                { label: "API Blocks", value: "apis" },
                {
                  label: `What's new${(activeVersion?.changes.length ?? 0) > 0 ? ` (${activeVersion!.changes.length})` : ""}`,
                  value: "whatsnew",
                },
                { label: "Schema", value: "schema" },
              ]}
            />
          </Group>

          {view === "apis" && (
            <BlockDefsPanel
              localBlocks={localBlocks}
              onAdd={(block) => {
                upsertLocalBlock(block);
                setLocalBlocks(loadLocalBlocks());
              }}
              onUpdate={(block) => {
                upsertLocalBlock(block);
                setLocalBlocks(loadLocalBlocks());
              }}
              onDelete={(kind) => {
                deleteLocalBlock(kind);
                setLocalBlocks(loadLocalBlocks());
              }}
            />
          )}

          {view === "schema" && <SchemaDocsPanel />}

          {view === "whatsnew" ? (
            <WhatsNewPanel />
          ) : view === "apis" || view === "schema" ? null : (
            <>
              {active && (
                <Group mb="md">
                  <SegmentedControl
                    size="xs"
                    value={activeMode}
                    onChange={(v) => {
                      if (!active) return;
                      if (v === "graph") enableGraphMode(active);
                      else setGraphMode((m) => ({ ...m, [active.id]: "list" }));
                    }}
                    data={[
                      { label: "List", value: "list" },
                      { label: "Graph", value: "graph" },
                    ]}
                  />
                </Group>
              )}

              {activeMode === "graph" && active?.graphData && (
                <GraphCanvas
                  scenario={active}
                  allScenarios={displayScenarios}
                  readOnly={!!activeProject}
                  onChange={updateActive}
                />
              )}

              {activeMode === "list" && (
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
            </>
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
