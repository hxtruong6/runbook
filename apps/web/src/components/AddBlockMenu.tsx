// src/components/AddBlockMenu.tsx
import { useState } from "react";
import { Button, Menu } from "@mantine/core";
import { useBlockRegistry } from "../blocks/RegistryContext";
import { SCENARIO_REF_KIND } from "../blocks/scenarioRef";
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
