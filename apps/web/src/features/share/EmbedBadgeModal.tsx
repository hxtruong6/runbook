/**
 * EmbedBadgeModal — lets users copy an HTML embed badge for a scenario.
 * Shows the badge preview and a copy-to-clipboard button.
 */
import { Box, Button, Code, Group, Modal, Stack, Text } from "@mantine/core";
import { useClipboard } from "@mantine/hooks";
import { IconCheck, IconCopy } from "@tabler/icons-react";

type Props = {
  opened: boolean;
  onClose: () => void;
  /** Optional scenario name to embed in the badge label */
  scenarioName?: string;
};

export function EmbedBadgeModal({ opened, onClose, scenarioName }: Props) {
  const clipboard = useClipboard({ timeout: 1500 });

  const badgeHtml = `<a href="${window.location.origin}${window.location.pathname}${scenarioName ? `#/run/${btoa(JSON.stringify({ scenarioName, runAt: new Date().toISOString(), blockResults: [] }))}` : ""}" target="_blank" rel="noopener noreferrer">
  <img src="https://img.shields.io/badge/runbook-${encodeURIComponent(scenarioName ?? "scenario")}-violet?logo=data:image/svg%2bxml;base64,..." alt="Run ${scenarioName ?? "scenario"}" />
</a>`;

  return (
    <Modal opened={opened} onClose={onClose} title="Embed badge">
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          Copy this HTML snippet to embed a badge linking to this scenario in
          your README or docs.
        </Text>

        {scenarioName && (
          <Box>
            <Text size="xs" fw={600} mb="xs">
              Preview
            </Text>
            <Box
              p="sm"
              style={{
                background: "var(--mantine-color-default-border)",
                borderRadius: "var(--mantine-radius-md)",
              }}
            >
              <Text size="xs" ff="monospace" c="dimmed">
                [{scenarioName}]
              </Text>
            </Box>
          </Box>
        )}

        <Code block style={{ fontSize: 12, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
          {badgeHtml}
        </Code>

        <Group justify="flex-end">
          <Button variant="subtle" onClick={onClose}>
            Close
          </Button>
          <Button
            leftSection={
              clipboard.copied ? <IconCheck size={14} /> : <IconCopy size={14} />
            }
            color={clipboard.copied ? "teal" : undefined}
            onClick={() => clipboard.copy(badgeHtml)}
          >
            {clipboard.copied ? "Copied!" : "Copy HTML"}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
