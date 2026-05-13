// src/App.tsx
import { useEffect, useMemo, useState } from "react";
import { useAuthStore } from "./auth/authStore";
import { LoginPage } from "./auth/LoginPage";
import { BurstDrawer } from "./components/BurstDrawer";
import { makeInitialContext } from "./context/ContextStore";
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
import { useTeamStore } from "./teams/teamStore";
import { CreateTeamModal } from "./teams/CreateTeamModal";
import { useProjectsStore } from "./projects/projectsStore";
import { useScenariosStore } from "./scenarios/scenariosStore";
import { runScenarioFrom } from "./execution/runScenario";
import { buildRegistry } from "./blocks";
import { getBaseUrl } from "./api/config";
import { RegistryProvider } from "./blocks/RegistryContext";
import { loadLocalBlocks, upsertLocalBlock, deleteLocalBlock } from "./blocks/localBlocksStore";
import type { BlockDefData } from "./blocks/dataBlock";
import {
  ActionIcon,
  Alert,
  AppShell,
  Badge,
  Button,
  Divider,
  Group,
  Menu,
  NavLink,
  SegmentedControl,
  ScrollArea,
  Skeleton,
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

export function AppContent() {
  const { activeTeamId, fetchTeams } = useTeamStore()
  const { projects, activeProjectId, fetchProjects } = useProjectsStore()
  const { scenarios, loading: scenariosLoading, error: scenariosError, fetchScenarios, createScenario, updateScenario, deleteScenario } = useScenariosStore()

  const [activeId, setActiveId] = useState<string | null>(null)
  const { context, dispatch } = useRuntimeContext();
  const { activeEnv } = useEnvironments();
  const [localBlocks, setLocalBlocks] = useState<BlockDefData[]>(() => loadLocalBlocks());
  const [view, setView] = useState<'blocks' | 'whatsnew' | 'apis' | 'schema'>('blocks')
  const [insertAfterIdx, setInsertAfterIdx] = useState<number | null>(null);
  const [burstOpen, setBurstOpen] = useState(false);
  const [graphMode, setGraphMode] = useState<Record<string, 'list' | 'graph'>>({});

  // Fetch teams on mount
  useEffect(() => {
    fetchTeams()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Fetch projects when active team changes
  useEffect(() => {
    if (activeTeamId) fetchProjects(activeTeamId)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTeamId])

  // Fetch scenarios when active project changes
  useEffect(() => {
    if (activeTeamId && activeProjectId) {
      fetchScenarios(activeTeamId, activeProjectId)
      setActiveId(null)
    } else {
      useScenariosStore.getState().reset()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTeamId, activeProjectId])

  // Auto-select first scenario when list loads
  useEffect(() => {
    if (scenarios.length > 0 && !activeId) {
      setActiveId(scenarios[0]!.id)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenarios])

  // Reset view when active project changes
  useEffect(() => {
    setView('blocks')
  }, [activeProjectId])

  const registry = useMemo(
    () => buildRegistry(localBlocks, getBaseUrl),
    [localBlocks]
  );

  const burstDeps = useMemo(() => ({
    scenarioLookup: (id: string) => scenarios.find((s) => s.id === id) ?? null,
    registry,
    env: activeEnv ?? null,
    makeCtx: makeInitialContext,
  }), [scenarios, registry, activeEnv]);

  const active = scenarios.find((s) => s.id === activeId) ?? null;
  const activeMode = active ? (graphMode[active.id] ?? (active.graphData ? 'graph' : 'list')) : 'list';
  const activeProject = projects.find((p) => p._id === activeProjectId) ?? null;

  function updateActive(next: Scenario) {
    if (!activeTeamId) return
    updateScenario(activeTeamId, next)
  }

  async function runFrom(startIdx: number) {
    if (!active) return;
    if (activeMode === 'graph' && active.graphData) {
      await runGraph(
        active.graphData,
        context,
        (newCtx) => { dispatch({ type: 'MERGE', values: newCtx }) },
        activeEnv,
        registry,
        (id) => scenarios.find((s) => s.id === id) ?? null,
      );
    } else {
      await runScenarioFrom(active.blocks, startIdx, context, (newCtx) => {
        dispatch({ type: 'MERGE', values: newCtx });
      }, activeEnv, registry);
    }
  }

  async function importScenario(s: Scenario) {
    if (!activeTeamId || !activeProjectId) return
    try {
      const created = await createScenario(activeTeamId, activeProjectId, s.name)
      updateScenario(activeTeamId, { ...created, blocks: s.blocks, reusable: s.reusable ?? false, graphData: s.graphData })
      setActiveId(created.id)
    } catch (e) {
      console.error('Failed to import scenario:', e)
    }
  }

  function openRenameModal(scenario: Scenario) {
    let newName = scenario.name;
    modals.open({
      title: 'Rename scenario',
      children: (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            const trimmed = newName.trim()
            if (trimmed && activeTeamId) {
              updateScenario(activeTeamId, { ...scenario, name: trimmed })
            }
            modals.closeAll()
          }}
        >
          <TextInput
            defaultValue={scenario.name}
            onChange={(e) => { newName = e.currentTarget.value }}
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
      title: 'Delete scenario',
      children: <Text size="sm">Delete &ldquo;{scenario.name}&rdquo;? This cannot be undone.</Text>,
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: () => {
        if (!activeTeamId) return
        deleteScenario(activeTeamId, scenario.id)
        if (activeId === scenario.id) {
          setActiveId(scenarios.find((s) => s.id !== scenario.id)?.id ?? null)
        }
      },
    });
  }

  function enableGraphMode(scenario: Scenario) {
    if (scenario.graphData) {
      setGraphMode((m) => ({ ...m, [scenario.id]: 'graph' }));
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
        blockInstance: { id: startId, kind: 'start', overrides: {} },
        name: 'Start',
        position: { x: 200, y: 0 },
      }]),
      edges: [],
    };
    updateActive({ ...scenario, graphData: initialGraphData });
    setGraphMode((m) => ({ ...m, [scenario.id]: 'graph' }));
  }

  return (
    <RegistryProvider registry={registry}>
      <AppShell
        navbar={{ width: 240, breakpoint: 'sm' }}
        aside={{ width: 320, breakpoint: 'md' }}
        header={{ height: 60 }}
        padding="md"
      >
        <AppShell.Header>
          <TopBar
            active={active}
            onRunAll={() => runFrom(0)}
            onImport={importScenario}
            onBurst={() => setBurstOpen(true)}
            onDuplicate={async (s) => {
              if (!activeTeamId || !activeProjectId) return
              try {
                const created = await createScenario(activeTeamId, activeProjectId, s.name + ' (copy)')
                updateScenario(activeTeamId, { ...created, blocks: s.blocks, reusable: s.reusable ?? false })
                setActiveId(created.id)
              } catch (e) {
                console.error('Failed to duplicate scenario:', e)
              }
            }}
            onToggleReusable={() => {
              if (!active) return
              updateActive({ ...active, reusable: !active.reusable })
            }}
          />
        </AppShell.Header>

        <AppShell.Navbar p="md" style={{ display: 'flex', flexDirection: 'column' }}>
          <Stack gap="xs" style={{ flexShrink: 0 }}>
            <ProjectSwitcher />
            <Divider my="sm" />

            {activeProject ? (
              <Text size="xs" c="dimmed">{activeProject.name}</Text>
            ) : (
              <Text size="xs" c="dimmed">No project selected</Text>
            )}

            <Group justify="space-between" mt="xs">
              <Text size="xs" tt="uppercase" c="dimmed" fw={600}>Scenarios</Text>
              <Text size="xs" c="dimmed">{scenarios.length}</Text>
            </Group>
          </Stack>

          <ScrollArea style={{ flex: 1, minHeight: 0 }} mt="xs">
            {scenariosLoading ? (
              <Stack gap={4}>
                {[1, 2, 3].map((i) => <Skeleton key={i} height={32} />)}
              </Stack>
            ) : scenariosError ? (
              <Alert color="red">{scenariosError}</Alert>
            ) : (
              <Stack gap={2}>
                {scenarios.length === 0 ? (
                  <Text size="xs" c="dimmed" pl="xs">
                    {activeProjectId ? 'No scenarios yet' : 'Select a project'}
                  </Text>
                ) : (
                  scenarios.map((s) => (
                    <NavLink
                      key={s.id}
                      label={s.name}
                      active={s.id === activeId}
                      onClick={() => setActiveId(s.id)}
                      style={{ borderRadius: 'var(--mantine-radius-md)' }}
                      rightSection={
                        <Group gap={4} wrap="nowrap">
                          {s.reusable && (
                            <Badge size="xs" variant="light" color="teal">reusable</Badge>
                          )}
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
                              <Menu.Item onClick={(e) => { e.stopPropagation(); openRenameModal(s) }}>
                                Rename
                              </Menu.Item>
                              <Menu.Item onClick={(e) => {
                                e.stopPropagation()
                                if (activeTeamId) updateScenario(activeTeamId, { ...s, reusable: !s.reusable })
                              }}>
                                {s.reusable ? 'Make a flow' : 'Make reusable'}
                              </Menu.Item>
                              <Menu.Item color="red" onClick={(e) => { e.stopPropagation(); openDeleteModal(s) }}>
                                Delete
                              </Menu.Item>
                            </Menu.Dropdown>
                          </Menu>
                        </Group>
                      }
                    />
                  ))
                )}
              </Stack>
            )}
          </ScrollArea>

          <Button
            variant="subtle"
            size="xs"
            leftSection={<IconPlus size={14} />}
            fullWidth
            disabled={!activeProjectId || !activeTeamId}
            mt="xs"
            style={{ flexShrink: 0 }}
            onClick={async () => {
              if (!activeTeamId || !activeProjectId) return
              try {
                const created = await createScenario(activeTeamId, activeProjectId, 'Untitled scenario')
                setActiveId(created.id)
              } catch (e) {
                console.error('Failed to create scenario:', e)
              }
            }}
          >
            New scenario
          </Button>
        </AppShell.Navbar>

        <AppShell.Aside p="md">
          <Stack gap="xs">
            <Text size="xs" tt="uppercase" c="dimmed" fw={600}>Context</Text>
            <ContextPanel />
          </Stack>
        </AppShell.Aside>

        <AppShell.Main>
          <Group justify="space-between" mb="md">
            <SegmentedControl
              size="xs"
              value={view}
              onChange={(v) => setView(v as 'blocks' | 'whatsnew' | 'apis' | 'schema')}
              data={[
                { label: 'Scenarios', value: 'blocks' },
                { label: 'API Blocks', value: 'apis' },
                { label: "What's new", value: 'whatsnew' },
                { label: 'Schema', value: 'schema' },
              ]}
            />
          </Group>

          {view === 'apis' && (
            <BlockDefsPanel
              localBlocks={localBlocks}
              onAdd={(block) => { upsertLocalBlock(block); setLocalBlocks(loadLocalBlocks()) }}
              onUpdate={(block) => { upsertLocalBlock(block); setLocalBlocks(loadLocalBlocks()) }}
              onDelete={(kind) => { deleteLocalBlock(kind); setLocalBlocks(loadLocalBlocks()) }}
            />
          )}

          {view === 'schema' && <SchemaDocsPanel />}
          {view === 'whatsnew' && <WhatsNewPanel />}

          {view === 'blocks' && (
            <>
              {active && (
                <Group mb="md">
                  <SegmentedControl
                    size="xs"
                    value={activeMode}
                    onChange={(v) => {
                      if (!active) return;
                      if (v === 'graph') enableGraphMode(active);
                      else setGraphMode((m) => ({ ...m, [active.id]: 'list' }));
                    }}
                    data={[
                      { label: 'List', value: 'list' },
                      { label: 'Graph', value: 'graph' },
                    ]}
                  />
                </Group>
              )}

              {activeMode === 'graph' && active?.graphData && (
                <GraphCanvas
                  scenario={active}
                  allScenarios={scenarios}
                  readOnly={false}
                  onChange={updateActive}
                />
              )}

              {activeMode === 'list' && (
                <Stack gap="md">
                  {active ? (
                    <>
                      {active.blocks.map((b, i) => (
                        <div key={b.id}>
                          <BlockCard
                            block={b}
                            scenarios={scenarios}
                            onChange={(next) => {
                              const updatedBlocks = [...active.blocks];
                              updatedBlocks[i] = next;
                              updateActive({ ...active, blocks: updatedBlocks });
                            }}
                            onRunFromHere={() => runFrom(i)}
                            onDuplicate={() => {
                              const clone = { ...b, id: crypto.randomUUID() };
                              const updatedBlocks = [...active.blocks];
                              updatedBlocks.splice(i + 1, 0, clone);
                              updateActive({ ...active, blocks: updatedBlocks });
                            }}
                            onRemove={() => {
                              updateActive({ ...active, blocks: active.blocks.filter((_, idx) => idx !== i) });
                            }}
                            onInsertBelow={() => setInsertAfterIdx(i)}
                          />
                          {insertAfterIdx === i && (
                            <AddBlockMenu
                              onAdd={(instance) => {
                                const updatedBlocks = [...active.blocks];
                                updatedBlocks.splice(i + 1, 0, instance);
                                updateActive({ ...active, blocks: updatedBlocks });
                                setInsertAfterIdx(null);
                              }}
                              scenarios={scenarios.filter((s) => s.id !== active.id)}
                              currentScenarioId={active.id}
                            />
                          )}
                        </div>
                      ))}
                      <AddBlockMenu
                        onAdd={(instance) => updateActive({ ...active, blocks: [...active.blocks, instance] })}
                        scenarios={scenarios.filter((s) => s.id !== active.id)}
                        currentScenarioId={active.id}
                      />
                    </>
                  ) : (
                    <Stack align="center" gap="xs" py="xl">
                      <ThemeIcon size={56} radius="xl" variant="light" color="gray">
                        <IconClipboardList size={28} />
                      </ThemeIcon>
                      <Text fw={600}>No scenario selected</Text>
                      <Text size="sm" c="dimmed" ta="center" maw={320}>
                        {activeProjectId
                          ? 'Pick a scenario from the sidebar, or create a new one.'
                          : 'Select or import a project to get started.'}
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
      <CreateTeamModal />
    </RegistryProvider>
  )
}

export function App() {
  const token = useAuthStore((s) => s.token)
  if (!token) return <LoginPage />
  return <AppContent />
}
