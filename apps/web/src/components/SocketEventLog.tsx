import { AnimatePresence, motion } from "framer-motion";
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
      <AnimatePresence initial={false}>
        {events.map((e, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
          >
            <Paper p="xs">
              <Text size="xs" c="dimmed">{e.receivedAt}</Text>
              <Code block style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 12 }}>
                {JSON.stringify(e.payload, null, 2)}
              </Code>
            </Paper>
          </motion.div>
        ))}
      </AnimatePresence>
    </Stack>
  );
}
