import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Alert, ActionIcon, Badge, Box, Button, Collapse, Group, Menu, Paper, Stack, Text, Textarea, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconLayoutColumns } from "@tabler/icons-react";
import { useBlockRegistry } from "../blocks/RegistryContext";
import { runBlock, resolveInputs } from "../execution/runScenario";
import type { Assertion, BlockInstance, BlockRunResult } from "../blocks/types";
import { useRuntimeContext } from "../context/ContextStore";
import { useEnvironments } from "../environments/EnvironmentsStore";
import { BlockForm } from "./BlockForm";
import { ResponseViewer } from "./ResponseViewer";
import { openChairsideSocket, type SocketEvent, type SocketSession } from "../api/socket";
import { SocketEventLog } from "./SocketEventLog";
import { SCENARIO_REF_KIND } from "../blocks/scenarioRef";
import type { Scenario } from "../scenarios/types";
import { ScenarioRefCard } from "./ScenarioRefCard";
import { evaluateAssertions, type AssertionResult } from "../execution/assertions";

export const STATUS_COLOR_BADGE: Record<string, string> = {
  idle: "gray",
  running: "yellow",
  ok: "teal",
  err: "red",
};

type Props = {
  block: BlockInstance;
  onChange: (next: BlockInstance) => void;
  onRunFromHere?: () => void;
  scenarios: Scenario[];
  onDuplicate?: () => void;
  onRemove?: () => void;
  onInsertBelow?: () => void;
};

export function BlockCard({ block, onChange, onRunFromHere, scenarios, onDuplicate, onRemove, onInsertBelow }: Props) {
  const registry = useBlockRegistry();
  const def = registry[block.kind];
  const { context, dispatch } = useRuntimeContext();
  const { activeEnv } = useEnvironments();
  const [result, setResult] = useState<BlockRunResult | null>(null);
  const [running, setRunning] = useState(false);
  const [split, setSplit] = useState(false);
  const sessionRef = useRef<SocketSession | null>(null);
  const [events, setEvents] = useState<SocketEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [assertionResults, setAssertionResults] = useState<AssertionResult[]>([]);
  const [assertionsOpen, setAssertionsOpen] = useState(false);

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
      <Alert color="red" variant="light">
        Unknown block kind: {block.kind}
      </Alert>
    );
  }

  const isSocket = def.kind === "socketConnect";

  function warnNoEnv() {
    notifications.show({
      color: 'red',
      title: 'No environment set',
      message: 'Add an environment in the sidebar before running blocks.',
    })
  }

  async function runHttp() {
    if (!activeEnv) { warnNoEnv(); return; }
    setRunning(true);
    const r = await runBlock(def, block, context, activeEnv);
    setResult(r);
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

  const status: "idle" | "running" | "ok" | "err" = isSocket
    ? connected ? "ok" : "idle"
    : running
    ? "running"
    : result?.status === "ok"
    ? "ok"
    : result?.status === "err"
    ? "err"
    : "idle";

  const statusLabel = isSocket ? (connected ? "connected" : "idle") : status;

  return (
    <Paper p="md" mb="sm">
      <Group justify="space-between" mb="sm">
        <Group gap="sm">
          <motion.div
            animate={status === 'running' ? { opacity: [1, 0.35, 1] } : { opacity: 1 }}
            transition={status === 'running'
              ? { duration: 1.4, repeat: Infinity, ease: 'easeInOut' }
              : { duration: 0.2 }}
            style={{ display: 'inline-flex' }}
          >
            <Badge variant="light" color={STATUS_COLOR_BADGE[status]} size="sm">
              {statusLabel}
            </Badge>
          </motion.div>
          <Title order={6} style={{ margin: 0 }}>
            {def.label}
          </Title>
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
              color={split ? "violet" : undefined}
            >
              <IconLayoutColumns size={14} />
            </ActionIcon>
          )}
          {isSocket ? (
            <Button
              variant="filled"
              size="xs"
              color={connected ? "red" : "violet"}
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
              {onRemove && (
                <>
                  <Menu.Divider />
                  <Menu.Item color="red" onClick={onRemove}>Remove</Menu.Item>
                </>
              )}
            </Menu.Dropdown>
          </Menu>
        </Group>
      </Group>
      {split ? (
        <Group align="flex-start" gap="md" wrap="nowrap" mt="sm">
          <Box style={{ flex: 1, minWidth: 0 }}>
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
                    color={assertions.length > 0 ? "violet" : undefined}
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
          <Box style={{ flex: 1, minWidth: 0 }}>
            <ResponseViewer result={result} />
            {assertionResults.length > 0 && (
              <Stack gap={4} mt="xs">
                <Text size="xs" fw={600} c="dimmed">Assertions</Text>
                {assertionResults.map((ar, i) => (
                  <Group key={i} gap="xs">
                    <Badge
                      size="xs"
                      color={ar.passed ? "teal" : "red"}
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
        </Group>
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
                  color={assertions.length > 0 ? "violet" : undefined}
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
              {assertionResults.length > 0 && (
                <Stack gap={4} mt="xs">
                  <Text size="xs" fw={600} c="dimmed">Assertions</Text>
                  {assertionResults.map((ar, i) => (
                    <Group key={i} gap="xs">
                      <Badge
                        size="xs"
                        color={ar.passed ? "teal" : "red"}
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
}
