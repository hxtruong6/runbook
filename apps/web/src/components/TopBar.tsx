// src/components/TopBar.tsx
import { useRef, useState } from "react";
import type { Scenario } from "../scenarios/types";
import { downloadScenario, readScenarioFile } from "../scenarios/exportImport";
import { EnvSwitcher } from "./EnvSwitcher";
import { EnvEditorModal } from "./EnvEditorModal";
import { Logo } from "./Logo";
import { ActionIcon, Badge, Button, Divider, Group, Menu, Title } from "@mantine/core";
import { useProjects } from "../projects/ProjectsStore";

const ZapIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
  </svg>
);

type Props = {
  active: Scenario | null;
  onRunAll: () => void;
  onImport: (s: Scenario) => void;
  onDuplicate?: (s: Scenario) => void;
  onToggleReusable?: () => void;
  onBurst?: () => void;
};

export function TopBar({ active, onRunAll, onImport, onDuplicate, onToggleReusable, onBurst }: Props) {
  const [editorOpen, setEditorOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { activeProject, activeVersion } = useProjects();

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const s = await readScenarioFile(file);
      onImport({ ...s, id: crypto.randomUUID(), createdAt: new Date().toISOString() });
    } catch (err) {
      alert("Invalid scenario file: " + (err as Error).message);
    }
    e.target.value = "";
  }

  function importHandler() {
    fileInputRef.current?.click();
  }

  function exportHandler() {
    if (active) downloadScenario(active);
  }

  function duplicateHandler() {
    if (!active || activeProject) return;
    onDuplicate?.({
      ...active,
      id: crypto.randomUUID(),
      name: active.name + " (copy)",
      createdAt: new Date().toISOString(),
    });
  }

  function toggleReusableHandler() {
    if (!active || activeProject) return;
    onToggleReusable?.();
  }

  return (
    <>
      <Group justify="space-between" h="100%" px="md">
        <Group gap="sm" align="center" wrap="nowrap">
          <Logo size={26} />
          <Divider orientation="vertical" />
          <EnvSwitcher onOpenEditor={() => setEditorOpen(true)} />
        </Group>

        <Group gap="xs" align="center">
          <Title order={5}>{active?.name ?? "No scenario"}</Title>
          {activeProject && (
            <Badge size="xs" variant="light" color="gray">
              {activeProject.name} @ {activeVersion?.version}
            </Badge>
          )}
          {active?.reusable === true && (
            <Badge size="xs" variant="light" color="violet">ref</Badge>
          )}
        </Group>

        <Group gap="xs">
          <Button variant="filled" disabled={!active} onClick={onRunAll} size="sm">
            Run all
          </Button>
          <Menu position="bottom-end" withinPortal>
            <Menu.Target>
              <ActionIcon variant="subtle" size="lg" aria-label="More actions">
                ⋮
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item
                disabled={!active}
                leftSection={<ZapIcon />}
                onClick={onBurst}
              >
                Burst…
              </Menu.Item>
              <Menu.Item onClick={importHandler}>Import scenario</Menu.Item>
              <Menu.Item onClick={exportHandler} disabled={!active}>Export scenario</Menu.Item>
              <Menu.Item onClick={duplicateHandler} disabled={!active || !!activeProject}>
                Duplicate scenario
              </Menu.Item>
              <Menu.Item onClick={toggleReusableHandler} disabled={!active || !!activeProject}>
                {active?.reusable ? "Mark as flow" : "Mark as reusable"}
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            hidden
            onChange={handleImport}
          />
        </Group>
      </Group>
      <EnvEditorModal opened={editorOpen} onClose={() => setEditorOpen(false)} />
    </>
  );
}
