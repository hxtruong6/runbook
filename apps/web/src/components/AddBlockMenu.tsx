// src/components/AddBlockMenu.tsx
import { useState } from "react";
import { Button, Menu, Stack, Text, Textarea } from "@mantine/core";
import { modals } from "@mantine/modals";
import { useBlockRegistry } from "../blocks/RegistryContext";
import { SCENARIO_REF_KIND } from "../blocks/scenarioRef";
import { parseCurl } from "../blocks/parseCurl";
import type { BlockInstance } from "../scenarios/types";
import type { Scenario } from "../scenarios/types";
import { ScenarioRefPickerModal } from "./ScenarioRefPickerModal";

type Props = {
  onAdd: (instance: BlockInstance) => void;
  scenarios: Scenario[];
  currentScenarioId: string;
  disabled?: boolean;
};

function makeInstance(kind: string): BlockInstance {
  return { id: crypto.randomUUID(), kind, overrides: {} };
}

function openCurlImportModal(onAdd: Props["onAdd"]) {
  modals.open({
    title: "Import from cURL",
    children: <CurlImportForm onAdd={onAdd} />,
  });
}

function CurlImportForm({ onAdd }: { onAdd: Props["onAdd"] }) {
  const [curlText, setCurlText] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit() {
    const parsed = parseCurl(curlText);
    if (!parsed) {
      setError("Couldn't parse cURL — check the format");
      return;
    }
    onAdd({
      id: crypto.randomUUID(),
      kind: "httpRequest",
      overrides: {
        method: parsed.method,
        url: parsed.url,
        headers: JSON.stringify(parsed.headers),
        body: parsed.body ?? "",
      },
    });
    modals.closeAll();
  }

  return (
    <Stack gap="sm">
      <Textarea
        label="Paste cURL command"
        placeholder={"curl -X POST https://api.example.com/endpoint \\\n  -H 'Content-Type: application/json' \\\n  -d '{\"key\":\"value\"}'"}
        minRows={4}
        autosize
        value={curlText}
        onChange={(e) => setCurlText(e.currentTarget.value)}
      />
      {error && (
        <Text size="xs" c="red" mt="xs">
          {error}
        </Text>
      )}
      <Button onClick={handleSubmit}>Create block</Button>
      <Button variant="subtle" onClick={() => modals.closeAll()}>Cancel</Button>
    </Stack>
  );
}

export function AddBlockMenu({ onAdd, scenarios, currentScenarioId, disabled }: Props) {
  const registry = useBlockRegistry();
  const [pickerOpen, setPickerOpen] = useState(false);

  // Exclude socketConnect from the menu; scenario-ref is handled separately
  const apiBlocks = Object.values(registry).filter(
    (def) => def.kind !== "socketConnect" && def.kind !== SCENARIO_REF_KIND
  );

  const otherScenarios = scenarios.filter((s) => s.id !== currentScenarioId);

  return (
    <>
      <Menu shadow="md" width={220}>
        <Menu.Target>
          <Button variant="default" size="sm" fullWidth disabled={disabled}>
            + Add block
          </Button>
        </Menu.Target>

        <Menu.Dropdown>
          <Menu.Label>API blocks</Menu.Label>
          {apiBlocks.map((def) => (
            <Menu.Item key={def.kind} onClick={() => onAdd(makeInstance(def.kind))}>
              {def.label}
            </Menu.Item>
          ))}

          <Menu.Divider />

          <Menu.Label>Composition</Menu.Label>
          <Menu.Item onClick={() => setPickerOpen(true)}>Reuse scenario…</Menu.Item>

          <Menu.Divider />

          <Menu.Label>Import</Menu.Label>
          <Menu.Item onClick={() => openCurlImportModal(onAdd)}>Import from cURL…</Menu.Item>
        </Menu.Dropdown>
      </Menu>

      <ScenarioRefPickerModal
        opened={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={(scenarioId, continueOnError) => {
          onAdd({
            id: crypto.randomUUID(),
            kind: SCENARIO_REF_KIND,
            overrides: { scenarioId, continueOnError },
          });
        }}
        scenarios={otherScenarios}
      />
    </>
  );
}
