// src/components/TopBar.tsx
import { useRef, useState } from "react";
import type { Scenario } from "../scenarios/types";
import { downloadScenario, readScenarioFile } from "../scenarios/exportImport";
import { EnvSwitcher } from "./EnvSwitcher";
import { EnvEditorModal } from "./EnvEditorModal";
import { Button, Group, Title } from "@mantine/core";

type Props = {
  active: Scenario | null;
  onRunAll: () => void;
  onImport: (s: Scenario) => void;
};

export function TopBar({ active, onRunAll, onImport }: Props) {
  const [editorOpen, setEditorOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  return (
    <>
      <Group justify="space-between" h="100%" px="md">
        <EnvSwitcher onOpenEditor={() => setEditorOpen(true)} />

        <Title order={5}>{active?.name ?? "No scenario"}</Title>

        <Group gap="xs">
          <Button variant="filled" disabled={!active} onClick={onRunAll} size="sm">
            Run all
          </Button>
          <Button
            variant="default"
            disabled={!active}
            onClick={() => active && downloadScenario(active)}
            size="sm"
          >
            Export
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
          >
            Import
          </Button>
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
