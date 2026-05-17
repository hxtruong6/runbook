/**
 * SharedRun — public read-only view of a single run result, optimised for
 * mobile (360px viewport and above).
 *
 * Layout rules (UX-D9):
 * - < 768px  : side panels (Context, Schema) collapse into Accordion
 * - ≥ 768px  : normal two-column layout (panels visible in aside)
 * - JSON viewer: font 13px monospace, line-wrap, no horizontal scroll
 * - Sticky CTA bar (Fork + Share) with ≥ 44px tap targets
 */
import {
  Accordion,
  Box,
  Button,
  Code,
  Group,
  Paper,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from "@mantine/core";
import { useClipboard } from "@mantine/hooks";
import {
  IconCheck,
  IconCopy,
  IconGitFork,
  IconShare,
} from "@tabler/icons-react";
import { useIsMobile } from "../hooks/useIsMobile";
import type { BlockRunResult } from "../blocks/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SharedRunData = {
  scenarioName: string;
  runAt: string;
  /** Block-level results in execution order */
  blockResults: Array<{
    label: string;
    kind: string;
    result: BlockRunResult;
  }>;
};

type Props = {
  data: SharedRunData;
  /** Called when the user taps "Fork" */
  onFork?: () => void;
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function JsonBlock({ value }: { value: unknown }) {
  const text =
    typeof value === "string" ? value : JSON.stringify(value, null, 2);
  return (
    <Code
      block
      data-testid="json-viewer"
      style={{
        fontSize: 13,
        fontFamily: "monospace",
        whiteSpace: "pre-wrap",
        wordBreak: "break-all",
        overflowX: "hidden",
      }}
    >
      {text}
    </Code>
  );
}

function BlockResultCard({
  label,
  kind,
  result,
}: {
  label: string;
  kind: string;
  result: BlockRunResult;
}) {
  const isOk = result.status === "ok";
  const httpStatus =
    "httpStatus" in result && result.httpStatus ? result.httpStatus : null;

  return (
    <Paper withBorder p="md" data-testid="block-result-card">
      <Stack gap="xs">
        <Group justify="space-between" wrap="wrap" gap="xs">
          <Group gap="xs">
            <ThemeIcon
              size="sm"
              color={isOk ? "teal" : "red"}
              variant="light"
              radius="sm"
            >
              {isOk ? <IconCheck size={14} /> : <IconCopy size={14} />}
            </ThemeIcon>
            <Text fw={600} size="sm">
              {label}
            </Text>
          </Group>
          <Group gap="xs">
            {httpStatus && (
              <Text size="xs" c="dimmed">
                HTTP {httpStatus}
              </Text>
            )}
            <Text size="xs" c="dimmed">
              {result.elapsedMs}ms
            </Text>
          </Group>
        </Group>

        {result.response != null && (
          <JsonBlock value={result.response} />
        )}

        {!isOk && result.error && (
          <Text size="xs" c="red">
            {result.error}
          </Text>
        )}

        <Text size="xs" c="dimmed" ff="monospace">
          {kind}
        </Text>
      </Stack>
    </Paper>
  );
}

/** Renders context / captured-values panel */
function ContextSummary({ results }: { results: SharedRunData["blockResults"] }) {
  const allCaptured = results.reduce<Record<string, unknown>>((acc, { result }) => {
    if (result.status === "ok") {
      Object.assign(acc, result.captured);
    }
    return acc;
  }, {});

  if (Object.keys(allCaptured).length === 0) {
    return (
      <Text size="sm" c="dimmed">
        No context captured in this run.
      </Text>
    );
  }

  return <JsonBlock value={allCaptured} />;
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export function SharedRun({ data, onFork }: Props) {
  const isMobile = useIsMobile();
  const clipboard = useClipboard({ timeout: 1500 });

  const ctaBar = (
    <Group
      gap="sm"
      style={{
        position: "sticky",
        bottom: 0,
        background: "var(--mantine-color-body)",
        padding: "var(--mantine-spacing-sm) 0",
        zIndex: 10,
      }}
    >
      {onFork && (
        <Button
          data-testid="fork-button"
          leftSection={<IconGitFork size={16} />}
          size="md"
          variant="light"
          onClick={onFork}
          style={{ flex: 1, minHeight: 44, fontSize: 16 }}
        >
          Fork
        </Button>
      )}
      <Button
        data-testid="share-button"
        leftSection={
          clipboard.copied ? <IconCheck size={16} /> : <IconShare size={16} />
        }
        size="md"
        variant="default"
        color={clipboard.copied ? "teal" : undefined}
        onClick={() => clipboard.copy(window.location.href)}
        style={{ flex: 1, minHeight: 44, fontSize: 16 }}
      >
        {clipboard.copied ? "Copied!" : "Share"}
      </Button>
    </Group>
  );

  const runResults = (
    <Stack gap="md">
      {data.blockResults.map(({ label, kind, result }, i) => (
        <BlockResultCard key={i} label={label} kind={kind} result={result} />
      ))}
    </Stack>
  );

  const contextPanel = <ContextSummary results={data.blockResults} />;

  return (
    <Box p="md" maw={960} mx="auto">
      {/* Header */}
      <Stack gap="xs" mb="lg">
        <Title order={3}>{data.scenarioName}</Title>
        <Text size="sm" c="dimmed">
          Ran{" "}
          {new Date(data.runAt).toLocaleString(undefined, {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Text>
      </Stack>

      {isMobile ? (
        /* ---- Mobile layout: accordion panels ---- */
        <Stack gap="md" data-testid="mobile-layout">
          {/* Run results always visible */}
          {runResults}

          {/* Side panels collapsed into Accordion */}
          <Accordion
            data-testid="side-panels-accordion"
            variant="separated"
            radius="md"
          >
            <Accordion.Item value="context">
              <Accordion.Control>Context</Accordion.Control>
              <Accordion.Panel>{contextPanel}</Accordion.Panel>
            </Accordion.Item>
          </Accordion>

          {ctaBar}
        </Stack>
      ) : (
        /* ---- Desktop layout: side-by-side ---- */
        <Group align="flex-start" gap="md" wrap="nowrap" data-testid="desktop-layout">
          <Stack gap="md" style={{ flex: 2, minWidth: 0 }}>
            {runResults}
            {ctaBar}
          </Stack>

          {/* Side panels always visible on desktop */}
          <Box
            style={{ flex: 1, minWidth: 240 }}
            data-testid="desktop-side-panels"
          >
            <Paper withBorder p="md">
              <Text size="xs" tt="uppercase" c="dimmed" fw={600} mb="sm">
                Context
              </Text>
              {contextPanel}
            </Paper>
          </Box>
        </Group>
      )}
    </Box>
  );
}
