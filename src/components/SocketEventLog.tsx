// src/components/SocketEventLog.tsx
import { Code, Paper, Stack, Text } from "@mantine/core";
import type { SocketEvent } from "../api/socket";

export function SocketEventLog({ events }: { events: SocketEvent[] }) {
  if (events.length === 0) {
    return (
      <Text size="xs" c="dimmed">
        No events yet.
      </Text>
    );
  }
  return (
    <Stack gap="xs" mt="xs">
      {events.map((e, i) => (
        <Paper key={i} p="xs">
          <Text size="xs" c="dimmed">
            {e.receivedAt}
          </Text>
          <Code block style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 12 }}>
            {JSON.stringify(e.payload, null, 2)}
          </Code>
        </Paper>
      ))}
    </Stack>
  );
}
