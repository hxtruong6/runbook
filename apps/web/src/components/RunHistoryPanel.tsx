import { useEffect, useState } from "react";
import {
  ActionIcon,
  Badge,
  Collapse,
  Group,
  Paper,
  Stack,
  Switch,
  Text,
} from "@mantine/core";
import { IconChevronDown, IconChevronUp } from "@tabler/icons-react";
import { loadRunHistory, type RunRecord } from "../execution/runHistory";
import { useRunHistoryStore } from "../state/runHistory";
import { RunDiff } from "../features/runs/RunDiff";

// localStorage key for the "compare with previous" toggle state per scenario
const compareToggleKey = (scenarioId: string) => `rb_compare_toggle:${scenarioId}`;

function loadCompareToggle(scenarioId: string): boolean {
  try {
    return localStorage.getItem(compareToggleKey(scenarioId)) === "true";
  } catch {
    return false;
  }
}

function saveCompareToggle(scenarioId: string, value: boolean): void {
  try {
    localStorage.setItem(compareToggleKey(scenarioId), String(value));
  } catch {
    // ignore
  }
}

type Props = {
  scenarioId: string;
  refreshKey: number;
};

export function RunHistoryPanel({ scenarioId, refreshKey }: Props) {
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<RunRecord[]>([]);
  const [compareEnabled, setCompareEnabled] = useState(() =>
    loadCompareToggle(scenarioId),
  );

  // Sync toggle state when scenarioId changes
  useEffect(() => {
    setCompareEnabled(loadCompareToggle(scenarioId));
  }, [scenarioId]);

  useEffect(() => {
    setHistory(loadRunHistory(scenarioId));
  }, [scenarioId, refreshKey]);

  function handleCompareToggle(checked: boolean) {
    setCompareEnabled(checked);
    saveCompareToggle(scenarioId, checked);
  }

  // Run result entries from the new diff-capable store
  const runEntries = useRunHistoryStore((s) => s.results[scenarioId] ?? []);
  const current = runEntries[0] ?? null;
  const previous = runEntries[1] ?? null;
  const canCompare = current !== null && previous !== null;

  return (
    <Stack gap="xs" mt="md">
      <Group justify="space-between">
        <Text size="xs" tt="uppercase" c="dimmed" fw={600}>
          Run history
        </Text>
        <Group gap="xs">
          {canCompare && (
            <Switch
              size="xs"
              label="Compare with previous"
              checked={compareEnabled}
              onChange={(e) => handleCompareToggle(e.currentTarget.checked)}
              data-testid="compare-toggle"
            />
          )}
          <ActionIcon
            size="xs"
            variant="subtle"
            aria-label="Toggle run history"
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <IconChevronUp size={12} /> : <IconChevronDown size={12} />}
          </ActionIcon>
        </Group>
      </Group>

      {/* Diff view — shown above history when toggle is on */}
      {compareEnabled && canCompare && current && previous && (
        <RunDiff current={current} previous={previous} />
      )}

      <Collapse in={open}>
        {history.length === 0 ? (
          <Text size="xs" c="dimmed">
            No run history yet.
          </Text>
        ) : (
          <Stack gap="xs">
            {history.map((r) => (
              <Paper key={r.id} withBorder p="xs">
                <Group justify="space-between">
                  <Text size="xs">
                    {new Date(r.runAt).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Text>
                  <Group gap="xs">
                    <Badge size="xs" color="teal">
                      {r.passCount} ok
                    </Badge>
                    {r.failCount > 0 && (
                      <Badge size="xs" color="red">
                        {r.failCount} failed
                      </Badge>
                    )}
                    <Text size="xs" c="dimmed">
                      {r.elapsedMs}ms
                    </Text>
                  </Group>
                </Group>
              </Paper>
            ))}
          </Stack>
        )}
      </Collapse>
    </Stack>
  );
}
