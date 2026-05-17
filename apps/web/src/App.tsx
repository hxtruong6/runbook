// src/App.tsx
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useHotkeys } from "@mantine/hooks";
import { useAuthStore } from "./auth/authStore";
import { LoginPage } from "./auth/LoginPage";
import { BurstDrawer } from "./components/BurstDrawer";
import { SearchModal } from "./components/SearchModal";
import { makeInitialContext } from "./context/ContextStore";
import type { Scenario } from "./scenarios/types";
import type { BlockInstance } from "./scenarios/types";
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
import { saveRunRecord } from "./execution/runHistory";
import { RunHistoryPanel } from "./components/RunHistoryPanel";
import { useRunHistoryStore } from "./state/runHistory";
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
  Box,
  Button,
  Code,
  Collapse,
  Divider,
  Group,
  Menu,
  Modal,
  NavLink,
  Paper,
  SegmentedControl,
  ScrollArea,
  Skeleton,
  Stack,
  Table,
  Tabs,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
  Tooltip,
} from "@mantine/core";
import { modals, openConfirmModal } from "@mantine/modals";
import { notifications } from "@mantine/notifications";
import { IconPlus, IconClipboardList, IconDots, IconTerminal2, IconTestPipe, IconBook2, IconChevronDown, IconChevronRight } from "@tabler/icons-react";
import { GraphCanvas } from "./components/GraphCanvas";
import { runGraph } from "./graph/runner";
import type { GraphData } from "./graph/types";
import { PREBUILT_SCENARIOS } from "./scenarios/prebuilt";
import { parseCurl } from "./blocks/parseCurl";

export function AppContent() {
  const { activeTeamId, fetchTeams } = useTeamStore()
  const { activeProjectId, fetchProjects } = useProjectsStore()
  const { scenarios, loading: scenariosLoading, error: scenariosError, fetchScenarios, createScenario, updateScenario, deleteScenario } = useScenariosStore()

  const [activeId, setActiveId] = useState<string | null>(null)
  const { context, dispatch } = useRuntimeContext();
  const { activeEnv } = useEnvironments();
  const [localBlocks, setLocalBlocks] = useState<BlockDefData[]>(() => loadLocalBlocks());
  const [asideTab, setAsideTab] = useState<'context' | 'schema'>('context')
  const [whatsNewOpen, setWhatsNewOpen] = useState(false)
  const [blockLibraryOpen, setBlockLibraryOpen] = useState(true)
  const [previewScenario, setPreviewScenario] = useState<typeof PREBUILT_SCENARIOS[number] | null>(null)
  const [navbarCollapsed, setNavbarCollapsed] = useState(false)
  const [asideCollapsed, setAsideCollapsed] = useState(false)
  const [sidebarMode, setSidebarMode] = useState<'scenarios' | 'library'>('scenarios')
  const [insertAfterIdx, setInsertAfterIdx] = useState<number | null>(null);
  const [burstOpen, setBurstOpen] = useState(false);
  const [graphMode, setGraphMode] = useState<Record<string, 'list' | 'graph'>>({});
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [runVersion, setRunVersion] = useState(0);
  const pushRunResult = useRunHistoryStore((s) => s.pushResult);

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

  function updateActive(next: Scenario) {
    if (!activeTeamId) return
    updateScenario(activeTeamId, next)
  }

  async function runFrom(startIdx: number) {
    if (!active) return;
    const startTime = Date.now();
    const collectedResults: import("./blocks/types").BlockRunResult[] = [];
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
      await runScenarioFrom(active.blocks, startIdx, context, (newCtx, _idx, result) => {
        dispatch({ type: 'MERGE', values: newCtx });
        collectedResults.push(result);
      }, activeEnv, registry);
    }
    const elapsedMs = Date.now() - startTime;
    saveRunRecord(active.id, {
      id: crypto.randomUUID(),
      runAt: new Date().toISOString(),
      blockCount: active.blocks.length,
      passCount: active.blocks.length,
      failCount: 0,
      elapsedMs,
    });
    // Push to the diff-capable run history store
    const lastOk = [...collectedResults].reverse().find((r) => r.status === 'ok');
    pushRunResult(active.id, {
      id: crypto.randomUUID(),
      runAt: new Date().toISOString(),
      blockResults: collectedResults,
      lastResponse: lastOk?.response ?? null,
    });
    setRunVersion((v) => v + 1);
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

  function handleSaveToLibrary(block: BlockInstance) {
    const def = registry[block.kind]
    if (!def) return
    const url = String(block.overrides.url ?? '')
    const method = String(block.overrides.method ?? 'GET').toUpperCase()
    let name = ''
    modals.open({
      title: 'Save to Block Library',
      children: (
        <Stack gap="sm">
          <Text size="sm" c="dimmed">Save this block as a reusable template in your library.</Text>
          <TextInput
            label="Block name"
            placeholder={def.label}
            defaultValue={def.label}
            onChange={(e) => { name = e.currentTarget.value }}
            data-autofocus
          />
          <Button onClick={() => {
            const finalName = name.trim() || def.label
            const kind = finalName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') + '-' + Date.now().toString(36)
            const newBlock: BlockDefData = {
              kind,
              label: finalName,
              auth: 'none',
              inputs: [
                { name: 'method', label: 'Method', type: 'enum', enumValues: ['GET', 'POST', 'PUT', 'DELETE'], required: true },
                { name: 'url', label: 'URL', type: 'string', required: true },
                { name: 'headers', label: 'Headers (JSON)', type: 'json' },
                { name: 'body', label: 'Body (JSON)', type: 'json' },
              ],
              outputs: [
                { jsonPath: 'data', contextKey: 'lastResponse' },
                { jsonPath: 'status', contextKey: 'lastStatus' },
              ],
              request: {
                method: (method === 'GET' || method === 'POST' || method === 'PUT' || method === 'DELETE') ? method as 'GET'|'POST'|'PUT'|'DELETE' : 'GET',
                urlTemplate: url,
              },
            }
            upsertLocalBlock(newBlock)
            setLocalBlocks(loadLocalBlocks())
            modals.closeAll()
            notifications.show({ color: 'green', message: `"${finalName}" saved to Block Library` })
          }}>
            Save
          </Button>
        </Stack>
      ),
    })
  }

  useHotkeys([
    ['mod+Enter', () => { if (active) runFrom(0); }],
    ['mod+shift+Enter', () => { if (active) runFrom(insertAfterIdx ?? 0); }],
    ['?', () => setShortcutsOpen(true)],
    ['mod+k', (e) => { e.preventDefault(); setSearchOpen(true); }],
  ]);

  return (
    <RegistryProvider registry={registry}>
      <AppShell
        navbar={{ width: 240, breakpoint: 'sm', collapsed: { desktop: navbarCollapsed, mobile: navbarCollapsed } }}
        aside={{ width: 320, breakpoint: 'md', collapsed: { desktop: asideCollapsed, mobile: asideCollapsed } }}
        header={{ height: 60 }}
        padding="md"
      >
        <AppShell.Header>
          <TopBar
            active={active}
            onRunAll={() => runFrom(0)}
            onImport={importScenario}
            onBurst={() => setBurstOpen(true)}
            onWhatsNew={() => setWhatsNewOpen(true)}
            onToggleNavbar={() => setNavbarCollapsed(c => !c)}
            onToggleAside={() => setAsideCollapsed(c => !c)}
            navbarCollapsed={navbarCollapsed}
            asideCollapsed={asideCollapsed}
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

        <AppShell.Navbar style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Activity bar — mode switcher */}
          <Group gap={0} px="xs" pt="xs" pb="xs" style={{ flexShrink: 0, borderBottom: '1px solid var(--mantine-color-default-border)' }}>
            <Tooltip label="Scenarios" withinPortal>
              <ActionIcon
                variant={sidebarMode === 'scenarios' ? 'light' : 'subtle'}
                color={sidebarMode === 'scenarios' ? 'violet' : 'gray'}
                size="md"
                aria-label="Scenarios view"
                onClick={() => setSidebarMode('scenarios')}
              >
                <IconClipboardList size={16} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Block Library" withinPortal>
              <ActionIcon
                variant={sidebarMode === 'library' ? 'light' : 'subtle'}
                color={sidebarMode === 'library' ? 'violet' : 'gray'}
                size="md"
                aria-label="Block library view"
                onClick={() => setSidebarMode('library')}
              >
                <IconBook2 size={16} />
              </ActionIcon>
            </Tooltip>
          </Group>

          {/* Project section — always visible */}
          <Box p="md" style={{ flexShrink: 0 }}>
            <ProjectSwitcher />
          </Box>

          <Divider />

          {/* Scenarios section — only in scenarios mode */}
          {sidebarMode === 'library' ? (
            <ScrollArea style={{ flex: 1, minHeight: 0 }} px="md" py="md">
              <BlockDefsPanel
                localBlocks={localBlocks}
                onAdd={(block) => { upsertLocalBlock(block); setLocalBlocks(loadLocalBlocks()) }}
                onUpdate={(block) => { upsertLocalBlock(block); setLocalBlocks(loadLocalBlocks()) }}
                onDelete={(kind) => { deleteLocalBlock(kind); setLocalBlocks(loadLocalBlocks()) }}
              />
            </ScrollArea>
          ) : (
          <>
          <Stack gap={0} style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <Group justify="space-between" px="md" py="xs" style={{ flexShrink: 0 }}>
              <Group gap="xs">
                <Text size="xs" tt="uppercase" c="dimmed" fw={600}>Scenarios</Text>
                <Badge size="xs" variant="light" color="gray">{scenarios.length}</Badge>
              </Group>
              <Tooltip label="New scenario" withinPortal>
                <ActionIcon
                  size="sm"
                  variant="subtle"
                  aria-label="New scenario"
                  disabled={!activeProjectId || !activeTeamId}
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
                  <IconPlus size={14} />
                </ActionIcon>
              </Tooltip>
            </Group>

            <ScrollArea style={{ flex: 1, minHeight: 0 }} px="md">
              {scenariosLoading ? (
                <Stack gap={4}>
                  {[1, 2, 3].map((i) => <Skeleton key={i} height={32} />)}
                </Stack>
              ) : scenariosError ? (
                <Stack gap={6}>
                  <Alert color="red">{scenariosError}</Alert>
                  <Button size="xs" variant="default" onClick={() => {
                    if (activeTeamId && activeProjectId) fetchScenarios(activeTeamId, activeProjectId)
                  }}>Retry</Button>
                </Stack>
              ) : (
                <Stack gap={2} pb="sm">
                  {scenarios.length === 0 ? (
                    <Text size="xs" c="dimmed" pl="xs">
                      {activeProjectId ? 'No scenarios yet' : 'Select a project above'}
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
                              <Badge size="xs" variant="light" color="teal">ref</Badge>
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
          </Stack>

          <Divider />

          {/* Block Library section — collapsible */}
          <Box style={{ flexShrink: 0, maxHeight: blockLibraryOpen ? 300 : 'auto', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <Group
              justify="space-between"
              px="md"
              py="xs"
              style={{ cursor: 'pointer', flexShrink: 0 }}
              onClick={() => setBlockLibraryOpen((o) => !o)}
            >
              <Group gap="xs">
                <IconBook2 size={14} color="var(--mantine-color-dimmed)" />
                <Text size="xs" tt="uppercase" c="dimmed" fw={600}>Block Library</Text>
                <Badge size="xs" variant="light" color="gray">{localBlocks.length}</Badge>
              </Group>
              {blockLibraryOpen ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
            </Group>
            <Collapse in={blockLibraryOpen}>
              <ScrollArea mah={240} px="md" pb="md">
                <BlockDefsPanel
                  localBlocks={localBlocks}
                  onAdd={(block) => { upsertLocalBlock(block); setLocalBlocks(loadLocalBlocks()) }}
                  onUpdate={(block) => { upsertLocalBlock(block); setLocalBlocks(loadLocalBlocks()) }}
                  onDelete={(kind) => { deleteLocalBlock(kind); setLocalBlocks(loadLocalBlocks()) }}
                />
              </ScrollArea>
            </Collapse>
          </Box>
          </>
          )}
        </AppShell.Navbar>

        <AppShell.Aside style={{ display: "flex", flexDirection: "column" }}>
          <Tabs
            value={asideTab}
            onChange={(v) => setAsideTab(v as 'context' | 'schema')}
            style={{ display: 'flex', flexDirection: 'column', height: '100%' }}
          >
            <Tabs.List px="md" pt="sm" style={{ flexShrink: 0 }}>
              <Tabs.Tab value="context">Context</Tabs.Tab>
              <Tabs.Tab value="schema">Schema</Tabs.Tab>
            </Tabs.List>
            <Box p="md" style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
              {asideTab === 'context' && <ContextPanel />}
              {asideTab === 'schema' && <SchemaDocsPanel />}
            </Box>
          </Tabs>
        </AppShell.Aside>

        <AppShell.Main>
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
                  <AnimatePresence initial={false}>
                    {active.blocks.map((b, i) => (
                      <motion.div
                        key={b.id}
                        initial={{ opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10, scale: 0.97 }}
                        transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
                      >
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
                            openConfirmModal({
                              title: 'Remove block',
                              children: <Text size="sm">Remove this block? This cannot be undone.</Text>,
                              labels: { confirm: 'Remove', cancel: 'Cancel' },
                              confirmProps: { color: 'red' },
                              onConfirm: () => updateActive({ ...active, blocks: active.blocks.filter((_, idx) => idx !== i) }),
                            })
                          }}
                          onInsertBelow={() => setInsertAfterIdx(i)}
                          onSaveToLibrary={() => handleSaveToLibrary(b)}
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
                            localBlockKinds={localBlocks.map((b) => b.kind)}
                          />
                        )}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  <AddBlockMenu
                    onAdd={(instance) => updateActive({ ...active, blocks: [...active.blocks, instance] })}
                    scenarios={scenarios.filter((s) => s.id !== active.id)}
                    currentScenarioId={active.id}
                    localBlockKinds={localBlocks.map((b) => b.kind)}
                  />
                  <RunHistoryPanel scenarioId={active.id} refreshKey={runVersion} />
                </>
              ) : (
                <Stack align="center" gap="md" py="xl">
                  {activeProjectId && scenarios.length === 0 ? (
                    <>
                      <ThemeIcon size={56} radius="xl" variant="light" color="violet">
                        <IconClipboardList size={28} />
                      </ThemeIcon>
                      <Text fw={600} size="lg">Start your first scenario</Text>
                      <Text size="sm" c="dimmed" ta="center" maw={380}>
                        Scenarios are sequences of API calls. Pick how you want to begin.
                      </Text>
                      <Group gap="md" mt="xs">
                        <Paper
                          withBorder
                          p="lg"
                          style={{ width: 160, cursor: 'pointer', textAlign: 'center' }}
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
                          <ThemeIcon size={40} radius="md" variant="light" color="violet" mb="sm">
                            <IconPlus size={20} />
                          </ThemeIcon>
                          <Text fw={600} size="sm">Start blank</Text>
                          <Text size="xs" c="dimmed" mt={4}>Empty scenario</Text>
                        </Paper>
                        <Paper
                          withBorder
                          p="lg"
                          style={{ width: 160, cursor: 'pointer', textAlign: 'center' }}
                          onClick={() => {
                            if (!activeTeamId || !activeProjectId) return
                            let curlInput = ''
                            modals.open({
                              title: 'Import from cURL',
                              children: (
                                <Stack gap="sm">
                                  <Textarea
                                    label="Paste your cURL command"
                                    placeholder={'curl -X POST https://api.example.com/endpoint -H \'Content-Type: application/json\' -d \'{"key":"value"}\''}
                                    minRows={5}
                                    autosize
                                    onChange={(e) => { curlInput = e.currentTarget.value }}
                                  />
                                  <Button
                                    onClick={async () => {
                                      const parsed = parseCurl(curlInput)
                                      if (!parsed) {
                                        alert('Could not parse cURL command. Make sure it contains a URL.')
                                        return
                                      }
                                      try {
                                        const overrides: Record<string, unknown> = {
                                          method: parsed.method,
                                          url: parsed.url,
                                          headers: JSON.stringify(parsed.headers),
                                        }
                                        if (parsed.body !== undefined) overrides.body = parsed.body
                                        const created = await createScenario(activeTeamId!, activeProjectId!, 'Imported scenario')
                                        const withBlock = { ...created, blocks: [{ id: `block-${Date.now()}`, kind: 'urlTemplate', overrides }] }
                                        await updateScenario(activeTeamId!, withBlock)
                                        setActiveId(created.id)
                                        modals.closeAll()
                                      } catch (e) {
                                        console.error('Failed to create scenario from cURL:', e)
                                      }
                                    }}
                                  >
                                    Create scenario
                                  </Button>
                                </Stack>
                              ),
                            })
                          }}
                        >
                          <ThemeIcon size={40} radius="md" variant="light" color="teal" mb="sm">
                            <IconTerminal2 size={20} />
                          </ThemeIcon>
                          <Text fw={600} size="sm">Import cURL</Text>
                          <Text size="xs" c="dimmed" mt={4}>Paste a cURL command</Text>
                        </Paper>
                        {PREBUILT_SCENARIOS.map((scenario) => (
                          <Paper
                            key={scenario.id}
                            withBorder
                            p="lg"
                            style={{ width: 160, cursor: 'pointer', textAlign: 'center' }}
                            onClick={() => setPreviewScenario(scenario)}
                          >
                            <ThemeIcon size={40} radius="md" variant="light" color="amber" mb="sm">
                              <IconTestPipe size={20} />
                            </ThemeIcon>
                            <Text fw={600} size="sm">{scenario.name.replace(/^Example: /, '')}</Text>
                            <Text size="xs" c="dimmed" mt={4}>{scenario.blocks.length} block{scenario.blocks.length !== 1 ? 's' : ''}</Text>
                          </Paper>
                        ))}
                      </Group>
                    </>
                  ) : activeProjectId ? (
                    <>
                      <ThemeIcon size={56} radius="xl" variant="light" color="gray">
                        <IconClipboardList size={28} />
                      </ThemeIcon>
                      <Text fw={600}>No scenario selected</Text>
                      <Text size="sm" c="dimmed" ta="center" maw={320}>
                        Pick a scenario from the sidebar, or create a new one to get started.
                      </Text>
                      <Button
                        size="sm"
                        leftSection={<IconPlus size={14} />}
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
                    </>
                  ) : (
                    <>
                      <ThemeIcon size={56} radius="xl" variant="light" color="gray">
                        <IconClipboardList size={28} />
                      </ThemeIcon>
                      <Text fw={600}>No project selected</Text>
                      <Text size="sm" c="dimmed" ta="center" maw={320}>
                        Create a new project or import a bundle to get started.
                      </Text>
                    </>
                  )}
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
      <CreateTeamModal />

      <SearchModal
        opened={searchOpen}
        onClose={() => setSearchOpen(false)}
        scenarios={scenarios}
        onSelectScenario={(id) => { setActiveId(id); }}
        registry={registry}
        envKeys={Object.keys(activeEnv ?? {})}
      />

      <Modal
        opened={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
        title="Keyboard shortcuts"
      >
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Shortcut</Table.Th>
              <Table.Th>Action</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            <Table.Tr>
              <Table.Td><Code>⌘ Enter</Code></Table.Td>
              <Table.Td>Run scenario from start</Table.Td>
            </Table.Tr>
            <Table.Tr>
              <Table.Td><Code>⌘ ⇧ Enter</Code></Table.Td>
              <Table.Td>Run from selected block</Table.Td>
            </Table.Tr>
            <Table.Tr>
              <Table.Td><Code>?</Code></Table.Td>
              <Table.Td>Show this help</Table.Td>
            </Table.Tr>
          </Table.Tbody>
        </Table>
      </Modal>

      <Modal
        opened={whatsNewOpen}
        onClose={() => setWhatsNewOpen(false)}
        title="What's new"
        size="lg"
      >
        <WhatsNewPanel />
      </Modal>

      <Modal
        opened={previewScenario !== null}
        onClose={() => setPreviewScenario(null)}
        title={previewScenario?.name ?? ''}
        size="sm"
      >
        {previewScenario && (
          <Stack gap="md">
            <Text size="sm" c="dimmed">
              This scenario contains {previewScenario.blocks.length} block{previewScenario.blocks.length !== 1 ? 's' : ''}:
            </Text>
            <Stack gap="xs">
              {previewScenario.blocks.map((b) => (
                <Group key={b.id} gap="sm">
                  <Badge size="xs" color="gray" variant="outline" style={{ fontFamily: 'monospace' }}>{b.kind}</Badge>
                  {Boolean(b.overrides.url) && (
                    <Text size="xs" c="dimmed" ff="monospace" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                      {String(b.overrides.method ?? 'GET')} {String(b.overrides.url)}
                    </Text>
                  )}
                </Group>
              ))}
            </Stack>
            <Group justify="flex-end" gap="sm">
              <Button variant="subtle" onClick={() => setPreviewScenario(null)}>Cancel</Button>
              <Button onClick={() => {
                importScenario(previewScenario)
                setPreviewScenario(null)
              }}>
                Load scenario
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </RegistryProvider>
  )
}

export function App() {
  const token = useAuthStore((s) => s.token)
  if (!token) return <LoginPage />
  return <AppContent />
}
