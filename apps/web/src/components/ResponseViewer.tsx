import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Badge,
  Button,
  Code,
  Group,
  Paper,
  ScrollArea,
  SegmentedControl,
  Stack,
  Tabs,
  Text,
} from "@mantine/core";
import { useClipboard } from "@mantine/hooks";
import { IconCheck, IconCopy, IconX } from "@tabler/icons-react";
import type { BlockRunResult, ResolvedRequest } from "../blocks/types";
import {
  generateAxios,
  generateCurl,
  generateNodeFetch,
  formatRequestResponse,
  redactHeaders,
  redactSnippet,
} from "./snippets";

function formatBytes(bytes: number): string {
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function ResultStatusBar({ result }: { result: BlockRunResult }) {
  const isOk = result.status === "ok";
  const code = "httpStatus" in result && result.httpStatus ? result.httpStatus : "—";
  const captured = isOk ? Object.keys(result.captured) : [];

  const responseSize =
    result.response != null
      ? new Blob([
          typeof result.response === "string"
            ? result.response
            : JSON.stringify(result.response),
        ]).size
      : null;

  return (
    <Paper p="xs" withBorder>
      <Group gap="xs" wrap="nowrap">
        <Text size="sm" fw={600} c={isOk ? "teal" : "red"}>
          {isOk ? <IconCheck size={14} /> : <IconX size={14} />}{" "}HTTP {code}
        </Text>
        <Text size="sm" c="dimmed">·</Text>
        <Text size="sm" c="dimmed">{result.elapsedMs}ms</Text>
        {responseSize != null && (
          <>
            <Text size="sm" c="dimmed">·</Text>
            <Text size="sm" c="dimmed">{formatBytes(responseSize)}</Text>
          </>
        )}
        {result.request && (
          <>
            <Text size="sm" c="dimmed">·</Text>
            <Text size="sm" c="dimmed" truncate="end">
              {result.request.method} {result.request.url}
            </Text>
          </>
        )}
      </Group>
      {!isOk && result.error && (
        <Text size="xs" mt="xs" c="red">{result.error}</Text>
      )}
      {isOk && captured.length > 0 && (
        <Text size="xs" mt="xs" c="dimmed">
          Captured: {captured.join(", ")}
        </Text>
      )}
    </Paper>
  );
}

function RequestTab({ request }: { request?: ResolvedRequest }) {
  if (!request) {
    return (
      <Text size="sm" c="dimmed" mt="xs">
        Request details not available.
      </Text>
    );
  }
  const displayed = redactHeaders(request.headers);
  return (
    <Stack gap="xs" mt="xs">
      <Group gap="xs">
        <Badge variant="light" size="sm">
          {request.method}
        </Badge>
        <Text size="xs" ff="monospace" truncate="end">
          {request.url}
        </Text>
      </Group>
      {Object.entries(displayed).map(([k, v]) => (
        <Group key={k} gap="xs">
          <Text size="xs" fw={600} ff="monospace">{k}:</Text>
          <Text size="xs" ff="monospace">{v}</Text>
        </Group>
      ))}
      {request.body !== undefined && (
        <Code block>
          {JSON.stringify(request.body, null, 2)}
        </Code>
      )}
    </Stack>
  );
}

const SNIPPET_LANGS = ["curl", "Node fetch", "Axios"] as const;
type SnippetLang = (typeof SNIPPET_LANGS)[number];

function buildSnippet(lang: SnippetLang, request: ResolvedRequest): string {
  if (lang === "curl") return generateCurl(request);
  if (lang === "Node fetch") return generateNodeFetch(request);
  return generateAxios(request);
}

function CodeTab({ request }: { request?: ResolvedRequest }) {
  const [lang, setLang] = useState<SnippetLang>("curl");
  const clipboard = useClipboard({ timeout: 1500 });

  if (!request) {
    return (
      <Text size="sm" c="dimmed" mt="xs">
        Request details not available.
      </Text>
    );
  }

  const realSnippet = buildSnippet(lang, request);
  const displaySnippet = redactSnippet(realSnippet, request.headers);

  return (
    <Stack gap="xs" mt="xs">
      <Group justify="space-between">
        <SegmentedControl
          size="xs"
          value={lang}
          onChange={(v) => setLang(v as SnippetLang)}
          data={[...SNIPPET_LANGS]}
        />
        <Button
          variant="subtle"
          size="xs"
          leftSection={clipboard.copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
          onClick={() => clipboard.copy(realSnippet)}
          color={clipboard.copied ? "teal" : undefined}
        >
          {clipboard.copied ? "Copied!" : "Copy"}
        </Button>
      </Group>
      <ScrollArea>
        <Code block>
          {displaySnippet}
        </Code>
      </ScrollArea>
    </Stack>
  );
}

export function ResponseViewer({ result }: { result: BlockRunResult | null }) {
  const clipboard = useClipboard({ timeout: 1500 });

  if (!result) return null;

  const responseText =
    typeof result.response === "string"
      ? result.response
      : JSON.stringify(result.response, null, 2);

  return (
    <Stack gap="xs" mt="xs">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={result.status + result.elapsedMs}
          initial={{
            boxShadow: result.status === 'ok'
              ? '0 0 0 3px var(--mantine-color-teal-4)'
              : '0 0 0 3px var(--mantine-color-red-4)',
          }}
          animate={{ boxShadow: '0 0 0 0px transparent' }}
          transition={{ duration: 0.85, ease: 'easeOut' }}
          style={{ borderRadius: 'var(--mantine-radius-lg)' }}
        >
          <ResultStatusBar result={result} />
        </motion.div>
      </AnimatePresence>
      <Tabs defaultValue="response">
        <Group justify="space-between" align="center" wrap="nowrap">
          <Tabs.List>
            <Tabs.Tab value="response">Response</Tabs.Tab>
            <Tabs.Tab value="request">Request</Tabs.Tab>
            <Tabs.Tab value="code">Code</Tabs.Tab>
          </Tabs.List>
          {result.request && (
            <Button
              variant="subtle"
              size="xs"
              leftSection={clipboard.copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
              onClick={() => result.request && clipboard.copy(formatRequestResponse(result.request, result))}
              color={clipboard.copied ? "teal" : undefined}
            >
              {clipboard.copied ? "Copied!" : "Copy request+response"}
            </Button>
          )}
        </Group>
        <Tabs.Panel value="response">
          <ScrollArea mah="40vh" mt="xs">
            <Code block>
              {responseText}
            </Code>
          </ScrollArea>
        </Tabs.Panel>
        <Tabs.Panel value="request">
          <RequestTab request={result.request} />
        </Tabs.Panel>
        <Tabs.Panel value="code">
          <CodeTab request={result.request} />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
