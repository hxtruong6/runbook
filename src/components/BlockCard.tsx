import { useEffect, useRef, useState } from "react";
import { Alert, ActionIcon, Badge, Button, Group, Menu, Paper, Title } from "@mantine/core";
import { useBlockRegistry } from "../blocks/RegistryContext";
import { runBlock, resolveInputs } from "../execution/runScenario";
import type { BlockInstance, BlockRunResult } from "../blocks/types";
import { useRuntimeContext } from "../context/ContextStore";
import { useEnvironments } from "../environments/EnvironmentsStore";
import { BlockForm } from "./BlockForm";
import { ResponseViewer } from "./ResponseViewer";
import { openChairsideSocket, type SocketEvent, type SocketSession } from "../api/socket";
import { SocketEventLog } from "./SocketEventLog";
import { SCENARIO_REF_KIND } from "../blocks/scenarioRef";
import type { Scenario } from "../scenarios/types";
import { ScenarioRefCard } from "./ScenarioRefCard";

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
  const sessionRef = useRef<SocketSession | null>(null);
  const [events, setEvents] = useState<SocketEvent[]>([]);
  const [connected, setConnected] = useState(false);

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

  async function runHttp() {
    setRunning(true);
    const r = await runBlock(def, block, context, activeEnv);
    setResult(r);
    if (r.status === "ok") dispatch({ type: "MERGE", values: r.captured });
    setRunning(false);
  }

  function connectSocket() {
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
          <Badge variant="light" color={STATUS_COLOR_BADGE[status]} size="sm">
            {statusLabel}
          </Badge>
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
      <BlockForm
        def={def}
        overrides={block.overrides}
        context={context}
        onChange={(o) => onChange({ ...block, overrides: o })}
      />
      {isSocket ? <SocketEventLog events={events} /> : <ResponseViewer result={result} />}
    </Paper>
  );
}
