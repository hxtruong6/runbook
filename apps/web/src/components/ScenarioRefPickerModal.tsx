// src/components/ScenarioRefPickerModal.tsx
import { useState } from "react";
import {
  Badge,
  Button,
  Divider,
  Group,
  Modal,
  Paper,
  Stack,
  Switch,
  Text,
  TextInput,
} from "@mantine/core";
import type { Scenario } from "../scenarios/types";

type Props = {
  opened: boolean;
  onClose: () => void;
  onPick: (scenarioId: string, continueOnError: boolean) => void;
  scenarios: Scenario[];
};

export function ScenarioRefPickerModal({ opened, onClose, onPick, scenarios }: Props) {
  const [filter, setFilter] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [continueOnError, setContinueOnError] = useState(false);

  const lc = filter.toLowerCase();
  const reusable = scenarios.filter((s) => s.reusable && s.name.toLowerCase().includes(lc));
  const others = scenarios.filter((s) => !s.reusable && s.name.toLowerCase().includes(lc));

  function handleClose() {
    setFilter("");
    setSelectedId(null);
    setContinueOnError(false);
    onClose();
  }

  function handleInsert() {
    if (!selectedId) return;
    onPick(selectedId, continueOnError);
    handleClose();
  }

  function ScenarioRow({ s, showBadge }: { s: Scenario; showBadge: boolean }) {
    const selected = selectedId === s.id;
    return (
      <Paper
        withBorder
        p="sm"
        onClick={() => setSelectedId(s.id)}
        style={{
          cursor: "pointer",
          borderColor: selected ? "var(--mantine-color-indigo-5)" : undefined,
        }}
      >
        <Group justify="space-between" wrap="nowrap">
          <div>
            <Text size="sm" fw={500}>
              {s.name}
            </Text>
            <Text size="xs" c="dimmed">
              {s.blocks.length} steps
            </Text>
          </div>
          {showBadge && (
            <Badge size="xs" variant="light" color="indigo">
              ref
            </Badge>
          )}
        </Group>
      </Paper>
    );
  }

  return (
    <Modal opened={opened} onClose={handleClose} title="Reuse scenario" size="md">
      <TextInput
        placeholder="Filter…"
        value={filter}
        onChange={(e) => setFilter(e.currentTarget.value)}
        mb="sm"
        autoFocus
      />

      <Stack gap="xs" mb="md">
        {reusable.length > 0 && (
          <>
            {reusable.map((s) => (
              <ScenarioRow key={s.id} s={s} showBadge={true} />
            ))}
          </>
        )}

        {others.length > 0 && (
          <>
            <Divider label="Other scenarios" />
            {others.map((s) => (
              <ScenarioRow key={s.id} s={s} showBadge={false} />
            ))}
          </>
        )}

        {reusable.length === 0 && others.length === 0 && (
          <Text size="sm" c="dimmed" ta="center" py="md">
            No scenarios match.
          </Text>
        )}
      </Stack>

      <Switch
        label="Continue on error if sub-scenario fails"
        checked={continueOnError}
        onChange={(e) => setContinueOnError(e.currentTarget.checked)}
        mb="md"
      />

      <Group justify="flex-end">
        <Button variant="default" onClick={handleClose}>
          Cancel
        </Button>
        <Button disabled={!selectedId} onClick={handleInsert}>
          Insert
        </Button>
      </Group>
    </Modal>
  );
}
