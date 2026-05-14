import { useEffect, useState } from "react";
import {
  ActionIcon,
  Badge,
  Collapse,
  Group,
  Paper,
  Stack,
  Text,
} from "@mantine/core";
import { IconChevronDown, IconChevronUp } from "@tabler/icons-react";
import { loadRunHistory, type RunRecord } from "../execution/runHistory";

type Props = {
  scenarioId: string;
  refreshKey: number;
};

export function RunHistoryPanel({ scenarioId, refreshKey }: Props) {
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<RunRecord[]>([]);

  useEffect(() => {
    setHistory(loadRunHistory(scenarioId));
  }, [scenarioId, refreshKey]);

  return (
    <Stack gap="xs" mt="md">
      <Group justify="space-between">
        <Text size="xs" tt="uppercase" c="dimmed" fw={600}>
          Run history
        </Text>
        <ActionIcon
          size="xs"
          variant="subtle"
          aria-label="Toggle run history"
          onClick={() => setOpen((o) => !o)}
        >
          {open ? <IconChevronUp size={12} /> : <IconChevronDown size={12} />}
        </ActionIcon>
      </Group>
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
