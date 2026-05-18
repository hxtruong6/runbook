// src/features/paste-curl/PasteCurlModal.tsx
import { useState } from "react";
import {
  Alert,
  Badge,
  Box,
  Button,
  Code,
  Group,
  Modal,
  Paper,
  Stack,
  Text,
  Textarea,
} from "@mantine/core";
import { IconTerminal2, IconAlertCircle } from "@tabler/icons-react";
import { parseCurl, type ParsedCurlResult } from "../../blocks/parseCurl";
import type { BlockDefData } from "../../blocks/dataBlock";
import { upsertLocalBlock } from "../../blocks/localBlocksStore";
import { notifications } from "@mantine/notifications";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Props = {
  opened: boolean;
  onClose: () => void;
  /** Called after the block has been inserted into the local library. */
  onInserted: (block: BlockDefData) => void;
};

// ---------------------------------------------------------------------------
// Helper: convert parsed curl to a BlockDefData
// ---------------------------------------------------------------------------

const SUPPORTED_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
type SupportedMethod = (typeof SUPPORTED_METHODS)[number];

function coerceMethod(raw: string): { method: SupportedMethod; coercedFrom?: string } {
  const upper = raw.toUpperCase();
  if ((SUPPORTED_METHODS as readonly string[]).includes(upper)) {
    return { method: upper as SupportedMethod };
  }
  // HEAD/OPTIONS/TRACE etc. aren't supported by the runtime — surface that
  // explicitly via the return value so the caller can warn the user instead
  // of silently saving a GET block that contradicts the pasted curl.
  return { method: "GET", coercedFrom: upper };
}

function curlToBlockDef(
  parsed: ParsedCurlResult
): { block: BlockDefData; coercedFrom?: string } {
  const { method, coercedFrom } = coerceMethod(parsed.method);

  // Derive a readable label from the URL
  let urlLabel: string;
  try {
    const u = new URL(parsed.url);
    const path = u.pathname.replace(/^\//, "").replace(/\/$/, "") || u.hostname;
    urlLabel = `${method} ${path.length > 40 ? path.slice(0, 40) + "…" : path}`;
  } catch {
    urlLabel = `${method} ${parsed.url.slice(0, 40)}`;
  }

  const suffix = Date.now().toString(36);
  const kind =
    urlLabel
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") +
    "-" +
    suffix;

  // Parse body into a usable template
  // Using `string` type to satisfy BlockDefData.request.bodyTemplate (JsonTemplateValue)
  // For JSON bodies we store the raw string; the runtime JSON-parses it.
  let bodyTemplate: string | undefined;
  if (parsed.body !== undefined) {
    bodyTemplate = parsed.body.trim();
  }

  const requestHeaders: Record<string, string> = { ...parsed.headers };

  // Curl import bakes method + URL into request.method / request.urlTemplate.
  // Re-exposing them as inputs renders empty fields and makes the block look
  // misconfigured (the form shows "— select —" + an empty URL textbox even
  // though the block runs correctly). Headers + body are still inputs so the
  // user can tweak them per-run.
  const block: BlockDefData = {
    kind,
    label: urlLabel,
    auth: "none",
    inputs: [
      ...(Object.keys(requestHeaders).length > 0
        ? [
            {
              name: "headers",
              label: "Headers (JSON)",
              type: "json" as const,
              location: "header" as const,
            },
          ]
        : []),
      ...(parsed.body !== undefined
        ? [
            {
              name: "body",
              label: "Body",
              type: "json" as const,
              location: "body" as const,
            },
          ]
        : []),
    ],
    outputs: [
      { jsonPath: "data", contextKey: "lastResponse" },
      { jsonPath: "status", contextKey: "lastStatus" },
    ],
    request: {
      method,
      urlTemplate: parsed.url,
      ...(Object.keys(requestHeaders).length > 0
        ? { headers: requestHeaders }
        : {}),
      ...(bodyTemplate !== undefined ? { bodyTemplate } : {}),
    },
  };
  return { block, coercedFrom };
}

// ---------------------------------------------------------------------------
// Preview component
// ---------------------------------------------------------------------------

function Preview({ parsed }: { parsed: ParsedCurlResult }) {
  const headerCount = Object.keys(parsed.headers).length;
  return (
    <Stack gap="xs">
      <Group gap="xs" wrap="nowrap">
        <Badge color="teal" size="sm">
          {parsed.method}
        </Badge>
        <Text size="xs" ff="monospace" style={{ wordBreak: "break-all" }}>
          {parsed.url}
        </Text>
      </Group>

      {headerCount > 0 && (
        <Box>
          <Text size="xs" c="dimmed" fw={600} mb={4}>
            Headers ({headerCount})
          </Text>
          {Object.entries(parsed.headers).map(([k, v]) => (
            <Group key={k} gap="xs" wrap="nowrap">
              <Code fz="xs">{k}</Code>
              <Text size="xs" c="dimmed" style={{ wordBreak: "break-all", flex: 1 }}>
                {v}
              </Text>
            </Group>
          ))}
        </Box>
      )}

      {parsed.body !== undefined && (
        <Box>
          <Text size="xs" c="dimmed" fw={600} mb={4}>
            Body
          </Text>
          <Code block fz="xs" style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
            {parsed.body.length > 400
              ? parsed.body.slice(0, 400) + "…"
              : parsed.body}
          </Code>
        </Box>
      )}

      {parsed.auth && (
        <Group gap="xs">
          <Badge color="amber" size="xs">
            Basic auth
          </Badge>
          <Text size="xs" c="dimmed">
            {parsed.auth.user}:***
          </Text>
        </Group>
      )}
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------

export function PasteCurlModal({ opened, onClose, onInserted }: Props) {
  const [curlInput, setCurlInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const parsed = curlInput.trim() ? parseCurl(curlInput) : null;

  function handleConfirm() {
    if (!parsed) {
      setError(
        "Could not parse cURL command. Make sure it starts with 'curl' and contains a URL."
      );
      return;
    }
    setError(null);

    const { block, coercedFrom } = curlToBlockDef(parsed);
    upsertLocalBlock(block);
    notifications.show({
      color: "green",
      message: `Block "${block.label}" added to your library`,
    });
    if (coercedFrom) {
      // Surface the silent fallback so the user knows their curl's method
      // didn't survive the round-trip — previously this defaulted to GET
      // with no warning and produced blocks whose label contradicted their
      // saved method.
      notifications.show({
        color: "amber",
        title: "Method not supported",
        message: `"${coercedFrom}" was saved as GET. Edit the block to change it.`,
      });
    }
    onInserted(block);
    setCurlInput("");
    onClose();
  }

  function handleClose() {
    setCurlInput("");
    setError(null);
    onClose();
  }

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={
        <Group gap="xs">
          <IconTerminal2 size={18} />
          <Text fw={600}>Paste cURL command</Text>
        </Group>
      }
      size="lg"
    >
      <Stack gap="md">
        <Textarea
          label="cURL command"
          description="Paste any curl command — headers, body, and auth will be extracted automatically."
          placeholder={
            "curl -X POST https://api.stripe.com/v1/customers \\\n  -u sk_test_xxx: \\\n  -H 'Content-Type: application/json' \\\n  -d '{\"email\":\"user@example.com\"}'"
          }
          value={curlInput}
          onChange={(e) => {
            setCurlInput(e.currentTarget.value);
            if (error) setError(null);
          }}
          minRows={5}
          autosize
          ff="monospace"
        />

        {error && (
          <Alert color="red" icon={<IconAlertCircle size={16} />}>
            {error}
          </Alert>
        )}

        {parsed && (
          <Paper withBorder p="sm">
            <Text size="xs" c="dimmed" fw={600} mb="xs">
              Preview
            </Text>
            <Preview parsed={parsed} />
          </Paper>
        )}

        {curlInput.trim() && !parsed && !error && (
          <Text size="xs" c="dimmed">
            Waiting for a valid curl command…
          </Text>
        )}

        <Group justify="flex-end" gap="sm">
          <Button variant="subtle" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            variant="light"
            color="teal"
            leftSection={<IconTerminal2 size={14} />}
            onClick={handleConfirm}
            disabled={!parsed}
          >
            Add to Block Library
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
