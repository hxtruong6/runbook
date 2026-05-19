import { useEffect, useRef, useState } from "react";
import { Alert, ActionIcon, Badge, Box, Button, Collapse, Group, Menu, Paper, Stack, Text, Textarea } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconLayoutColumns } from "@tabler/icons-react";
import { Group as PanelGroup, Panel, Separator as PanelResizeHandle, type Layout } from "react-resizable-panels";

const SPLIT_STORAGE_KEY = "rb_block_editor_split";
// react-resizable-panels v4 treats bare numbers as pixels (breaking change
// from older versions where bare numbers were percentages). We want
// percentage-based sizing, so always suffix with "%".
const DEFAULT_SPLIT = 50;
const MIN_SPLIT_PCT = 30;
const pct = (n: number) => `${n}%`;

function loadSplitSize(blockKind: string): number {
  try {
    const raw = localStorage.getItem(SPLIT_STORAGE_KEY);
    if (!raw) return DEFAULT_SPLIT;
    const stored = JSON.parse(raw) as Record<string, number>;
    const val = stored[blockKind];
    // Reject out-of-range values (older versions stored pixel sizes here,
    // which become e.g. "250%" when fed back as a percentage).
    if (typeof val !== "number" || val < MIN_SPLIT_PCT || val > 100) {
      return DEFAULT_SPLIT;
    }
    return val;
  } catch {
    return DEFAULT_SPLIT;
  }
}

function saveSplitSize(blockKind: string, size: number) {
  try {
    const raw = localStorage.getItem(SPLIT_STORAGE_KEY);
    const stored = raw ? (JSON.parse(raw) as Record<string, number>) : {};
    stored[blockKind] = size;
    localStorage.setItem(SPLIT_STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // ignore storage errors
  }
}
import { useBlockRegistry } from "../blocks/RegistryContext";
import { runBlock, resolveInputs } from "../execution/runScenario";
import type { Assertion, BlockInstance, BlockRunResult } from "../blocks/types";
import { captureRun } from "../inference/inferenceStore";
import { InferenceBanner } from "../inference/InferenceBanner";
import { useRuntimeContext } from "../context/ContextStore";
import { useEnvironments } from "../environments/EnvironmentsStore";
import { BlockForm } from "./BlockForm";
import { ResponseViewer } from "./ResponseViewer";
import { openChairsideSocket, type SocketEvent, type SocketSession } from "../api/socket";
import { SocketEventLog } from "./SocketEventLog";
import { StatusBadge, type RunStatus } from "./StatusBadge";
import { SCENARIO_REF_KIND } from "../blocks/scenarioRef";
import type { Scenario } from "../scenarios/types";
import { ScenarioRefCard } from "./ScenarioRefCard";
import { evaluateAssertions, type AssertionResult } from "../execution/assertions";

export const STATUS_COLOR_BADGE: Record<string, string> = {
  idle: "gray",
  running: "amber",
  ok: "sage",
  err: "coral",
  connected: "sage",
};

type Props = {
  block: BlockInstance;
  onChange: (next: BlockInstance) => void;
  onRunFromHere?: () => void;
  scenarios: Scenario[];
  onDuplicate?: () => void;
  onRemove?: () => void;
  onInsertBelow?: () => void;
  onSaveToLibrary?: () => void;
  /** 0-based position in the scenario; renders the design-system step rail when provided. */
  index?: number;
  /** Total blocks in the scenario; hides the rail's bottom line on the last block. */
  totalBlocks?: number;
  /** Indicates the currently-running step in a Run-all flow; tints the step circle. */
  isCurrent?: boolean;
};

export function BlockCard({ block, onChange, onRunFromHere, scenarios, onDuplicate, onRemove, onInsertBelow, onSaveToLibrary, index, totalBlocks, isCurrent }: Props) {
  const registry = useBlockRegistry();
  const def = registry[block.kind];
  const { context, dispatch } = useRuntimeContext();
  const { activeEnv } = useEnvironments();
  const [result, setResult] = useState<BlockRunResult | null>(null);
  const [running, setRunning] = useState(false);
  const [split, setSplit] = useState(false);
  const [splitSize, setSplitSize] = useState(() => loadSplitSize(block.kind));
  const sessionRef = useRef<SocketSession | null>(null);
  const [events, setEvents] = useState<SocketEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [assertionResults, setAssertionResults] = useState<AssertionResult[]>([]);
  const [assertionsOpen, setAssertionsOpen] = useState(false);
  const [flash, setFlash] = useState<"ok" | "err" | null>(null);
  // Trigger the result-flash ring on completion. Cleared after ~0.9s so the
  // animation does not stack on rapid reruns.
  useEffect(() => {
    if (!result || running) return;
    const next = result.status === "ok" ? "ok" : result.status === "err" ? "err" : null;
    if (!next) return;
    setFlash(next);
    const t = setTimeout(() => setFlash(null), 900);
    return () => clearTimeout(t);
  }, [result, running]);

  const assertions: Assertion[] = (() => {
    try {
      const raw = block.overrides._assertions;
      if (!raw) return [];
      return JSON.parse(typeof raw === "string" ? raw : JSON.stringify(raw)) as Assertion[];
    } catch { return []; }
  })();

  useEffect(() => {
    return () => sessionRef.current?.disconnect();
  }, []);

  if (block.kind === SCENARIO_REF_KIND) {
    return (
      <ScenarioRefCard
        block={block}
        onChange={onChange}
        scenarios={scenarios}
        onRunFromHere={onRunFromHere}
        onDuplicate={onDuplicate}
        onRemove={onRemove}
        onInsertBelow={onInsertBelow}
      />
    );
  }

  if (!def) {
    return (
      <Alert color="coral" variant="light">
        Unknown block kind: {block.kind}
      </Alert>
    );
  }

  const isSocket = def.kind === "socketConnect";

  function warnNoEnv() {
    notifications.show({
      color: 'coral',
      title: 'No environment set',
      message: 'Add an environment in the sidebar before running blocks.',
    })
  }

  async function runHttp() {
    // Env is only required when the block's URL template is relative.
    // Absolute URLs (e.g. from a curl paste) can run without one.
    const urlTemplate = def.urlTemplate ?? '';
    const isAbsolute = /^https?:\/\//i.test(urlTemplate);
    if (!activeEnv && !isAbsolute) { warnNoEnv(); return; }
    setRunning(true);
    const r = await runBlock(def, block, context, activeEnv);
    setResult(r);
    captureRun(block.kind, r);
    if (r.status === "ok") dispatch({ type: "MERGE", values: r.captured });
    if (assertions.length > 0) {
      setAssertionResults(evaluateAssertions(r as object, assertions));
    } else {
      setAssertionResults([]);
    }
    setRunning(false);
  }

  function connectSocket() {
    if (!activeEnv) { warnNoEnv(); return; }
    sessionRef.current?.disconnect();
    const values = resolveInputs(def, block, context);
    if (!values.userId || !values.orthoReviewId || !values.role) {
      setResult({ status: "err", elapsedMs: 0, response: null, error: "Missing userId/role/orthoReviewId" });
      return;
    }
    const session = openChairsideSocket({
      userId: String(values.userId),
      role: String(values.role),
      orthoReviewId: String(values.orthoReviewId),
      ownSocketSessionUuid: context.socketSessionUuid,
    });
    sessionRef.current = session;
    setConnected(true);
    session.subscribe(setEvents);
  }

  function disconnectSocket() {
    sessionRef.current?.disconnect();
    sessionRef.current = null;
    setConnected(false);
  }

  const status: RunStatus = isSocket
    ? connected ? "connected" : "idle"
    : running
    ? "running"
    : result?.status === "ok"
    ? "ok"
    : result?.status === "err"
    ? "err"
    : "idle";

  const capturedKeys = result?.status === "ok" && result.captured ? Object.keys(result.captured) : [];

  const showRail = typeof index === "number";
  const isLast = typeof totalBlocks === "number" && typeof index === "number" && index === totalBlocks - 1;
  const stepStatusCls =
    status === "running" ? "rb-block-step--running" :
    status === "ok"      ? "rb-block-step--ok" :
    status === "err"     ? "rb-block-step--err" : "";

  const card = (
    <Paper p="md" mb={showRail ? 0 : "sm"} data-flash={flash ?? undefined} style={{ flex: 1, minWidth: 0 }}>
      <Group justify="space-between" mb="sm">
        <Group gap="sm">
          <StatusBadge status={status} />
          <InlineLabel
            value={(typeof block.overrides._label === "string" ? block.overrides._label : "") || def.label}
            onCommit={(next) => onChange({ ...block, overrides: { ...block.overrides, _label: next } })}
          />
          {/* Hide the kind badge when it's an auto-generated curl/import id
              (looks like "get-users-1-mpa1ftnl"). Built-in kinds stay
              visible because they're useful as context references. */}
          {!/-[a-z0-9]{6,}$/.test(block.kind) && (
            <Badge variant="outline" color="gray" size="xs" style={{ fontFamily: 'monospace' }}>
              {block.kind}
            </Badge>
          )}
        </Group>
        <Group gap="xs">
          {onRunFromHere && !isSocket && (
            <Button variant="default" size="xs" onClick={onRunFromHere}>
              Run from here
            </Button>
          )}
          {!isSocket && (
            <ActionIcon
              variant="subtle"
              size="sm"
              aria-label={split ? "Switch to stack layout" : "Switch to split layout"}
              onClick={() => setSplit(s => !s)}
              color={split ? "indigo" : undefined}
            >
              <IconLayoutColumns size={14} />
            </ActionIcon>
          )}
          {isSocket ? (
            <Button
              variant="filled"
              size="xs"
              color={connected ? "coral" : "indigo"}
              onClick={connected ? disconnectSocket : connectSocket}
            >
              {connected ? "Disconnect" : "Connect"}
            </Button>
          ) : (
            <Button
              variant="filled"
              size="xs"
              loading={running}
              onClick={runHttp}
            >
              Run
            </Button>
          )}
          <Menu shadow="md" width={180} position="bottom-end">
            <Menu.Target>
              <ActionIcon variant="subtle" size="sm" aria-label="Block actions">
                ⋮
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              {onRunFromHere && !isSocket && (
                <Menu.Item onClick={onRunFromHere}>Run from here</Menu.Item>
              )}
              {onDuplicate && <Menu.Item onClick={onDuplicate}>Duplicate</Menu.Item>}
              {onInsertBelow && <Menu.Item onClick={onInsertBelow}>Insert below…</Menu.Item>}
              {onSaveToLibrary && !['socketConnect', 'scenario-ref', 'start'].includes(block.kind) && (
                <Menu.Item onClick={onSaveToLibrary}>Save to Block Library…</Menu.Item>
              )}
              {onRemove && (
                <>
                  <Menu.Divider />
                  <Menu.Item color="coral" onClick={onRemove}>Remove</Menu.Item>
                </>
              )}
            </Menu.Dropdown>
          </Menu>
        </Group>
      </Group>
      {split ? (
        <PanelGroup
          orientation="horizontal"
          style={{ marginTop: 'var(--mantine-spacing-sm)' }}
          onLayoutChanged={(layout: Layout) => {
            const leftSize = layout[`${block.kind}-left`];
            if (leftSize !== undefined) {
              setSplitSize(leftSize);
              saveSplitSize(block.kind, leftSize);
            }
          }}
        >
          <Panel
            id={`${block.kind}-left`}
            defaultSize={pct(splitSize)}
            minSize={pct(MIN_SPLIT_PCT)}
            style={{ minWidth: 0 }}
          >
            <Box pr="sm">
              <BlockForm
                def={def}
                overrides={block.overrides}
                context={context}
                onChange={(o) => onChange({ ...block, overrides: o })}
              />
              {!isSocket && (
                <>
                  <Group mt="xs">
                    <Button
                      variant="subtle"
                      size="xs"
                      onClick={() => setAssertionsOpen(o => !o)}
                      color={assertions.length > 0 ? "indigo" : undefined}
                    >
                      Assertions {assertions.length > 0 ? `(${assertions.length})` : ""}
                    </Button>
                  </Group>
                  <Collapse in={assertionsOpen}>
                    <Textarea
                      size="xs"
                      mt="xs"
                      placeholder='[{"path":"httpStatus","op":"eq","value":200}]'
                      value={typeof block.overrides._assertions === "string" ? block.overrides._assertions : ""}
                      onChange={(e) => onChange({ ...block, overrides: { ...block.overrides, _assertions: e.currentTarget.value } })}
                      autosize
                      minRows={2}
                      label="Assertions (JSON array)"
                    />
                  </Collapse>
                </>
              )}
            </Box>
          </Panel>
          <PanelResizeHandle
            style={{
              width: 6,
              cursor: 'col-resize',
              background: 'var(--mantine-color-default-border)',
              borderRadius: 3,
              margin: '0 2px',
            }}
          />
          <Panel minSize={pct(MIN_SPLIT_PCT)} style={{ minWidth: 0 }}>
            <Box pl="sm">
              <ResponseViewer result={result} />
              {capturedKeys.length > 0 && (
                <Group gap={6} mt="xs" wrap="wrap" align="center">
                  <Text size="xs" c="dimmed" fw={600} tt="uppercase">Captured →</Text>
                  {capturedKeys.map((k) => (
                    <Badge key={k} size="xs" color="indigo" variant="light" style={{ fontFamily: 'var(--mantine-font-family-monospace)' }}>
                      {k}
                    </Badge>
                  ))}
                </Group>
              )}
              {!isSocket && <InferenceBanner kind={block.kind} />}
              {assertionResults.length > 0 && (
                <Stack gap={4} mt="xs">
                  <Text size="xs" fw={600} c="dimmed">Assertions</Text>
                  {assertionResults.map((ar, i) => (
                    <Group key={i} gap="xs">
                      <Badge
                        size="xs"
                        color={ar.passed ? "sage" : "coral"}
                        variant="light"
                      >
                        {ar.passed ? "pass" : "fail"}
                      </Badge>
                      <Text size="xs">{ar.assertion.label ?? ar.assertion.path} {ar.assertion.op} {String(ar.assertion.value ?? "")}</Text>
                      {!ar.passed && (
                        <Text size="xs" c="dimmed">got: {String(ar.actual)}</Text>
                      )}
                    </Group>
                  ))}
                </Stack>
              )}
            </Box>
          </Panel>
        </PanelGroup>
      ) : (
        <>
          <BlockForm
            def={def}
            overrides={block.overrides}
            context={context}
            onChange={(o) => onChange({ ...block, overrides: o })}
          />
          {!isSocket && (
            <>
              <Group mt="xs">
                <Button
                  variant="subtle"
                  size="xs"
                  onClick={() => setAssertionsOpen(o => !o)}
                  color={assertions.length > 0 ? "indigo" : undefined}
                >
                  Assertions {assertions.length > 0 ? `(${assertions.length})` : ""}
                </Button>
              </Group>
              <Collapse in={assertionsOpen}>
                <Textarea
                  size="xs"
                  mt="xs"
                  placeholder='[{"path":"httpStatus","op":"eq","value":200}]'
                  value={typeof block.overrides._assertions === "string" ? block.overrides._assertions : ""}
                  onChange={(e) => onChange({ ...block, overrides: { ...block.overrides, _assertions: e.currentTarget.value } })}
                  autosize
                  minRows={2}
                  label="Assertions (JSON array)"
                />
              </Collapse>
            </>
          )}
          {isSocket ? <SocketEventLog events={events} /> : (
            <>
              <ResponseViewer result={result} />
              {capturedKeys.length > 0 && (
                <Group gap={6} mt="xs" wrap="wrap" align="center">
                  <Text size="xs" c="dimmed" fw={600} tt="uppercase">Captured →</Text>
                  {capturedKeys.map((k) => (
                    <Badge key={k} size="xs" color="indigo" variant="light" style={{ fontFamily: 'var(--mantine-font-family-monospace)' }}>
                      {k}
                    </Badge>
                  ))}
                </Group>
              )}
              {!isSocket && <InferenceBanner kind={block.kind} />}
              {assertionResults.length > 0 && (
                <Stack gap={4} mt="xs">
                  <Text size="xs" fw={600} c="dimmed">Assertions</Text>
                  {assertionResults.map((ar, i) => (
                    <Group key={i} gap="xs">
                      <Badge
                        size="xs"
                        color={ar.passed ? "sage" : "coral"}
                        variant="light"
                      >
                        {ar.passed ? "pass" : "fail"}
                      </Badge>
                      <Text size="xs">{ar.assertion.label ?? ar.assertion.path} {ar.assertion.op} {String(ar.assertion.value ?? "")}</Text>
                      {!ar.passed && (
                        <Text size="xs" c="dimmed">got: {String(ar.actual)}</Text>
                      )}
                    </Group>
                  ))}
                </Stack>
              )}
            </>
          )}
        </>
      )}
    </Paper>
  );

  if (!showRail) return card;

  return (
    <div style={{ display: "flex", gap: 12, alignItems: "stretch", marginBottom: "var(--mantine-spacing-sm)" }}>
      <div className="rb-block-rail" aria-hidden="true">
        <div className={`rb-block-step ${stepStatusCls} ${isCurrent ? "rb-block-step--current" : ""}`}>
          {(index as number) + 1}
        </div>
        {!isLast && <div className="rb-block-rail-line" />}
      </div>
      {card}
    </div>
  );
}

/* InlineLabel — view shows title + pencil-on-hover. Click or focus to
 * edit; Enter / blur commits, Esc cancels. Mirrors the handoff
 * EditableLabel pattern from BlockCard.jsx. */
function InlineLabel({ value, onCommit }: { value: string; onCommit: (next: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);
  useEffect(() => { if (!editing) setDraft(value); }, [value, editing]);
  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          const next = draft.trim();
          if (next && next !== value) onCommit(next);
          setEditing(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); (e.target as HTMLInputElement).blur(); }
          else if (e.key === "Escape") { e.preventDefault(); setDraft(value); setEditing(false); }
        }}
        aria-label="Block label"
        style={{
          font: "650 14px/1.3 var(--mantine-font-family)",
          color: "var(--mantine-color-text)",
          background: "var(--mantine-color-default-hover)",
          border: "1px solid var(--mantine-color-default-border)",
          borderRadius: 6,
          padding: "2px 6px",
          maxWidth: 280,
        }}
      />
    );
  }
  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      aria-label={`Rename "${value}"`}
      style={{
        font: "650 14px/1.3 var(--mantine-font-family)",
        color: "var(--mantine-color-text)",
        background: "transparent",
        border: "1px solid transparent",
        borderRadius: 6,
        padding: "2px 6px",
        cursor: "pointer",
      }}
    >
      {value}
    </button>
  );
}
