import { useEffect, useRef, useState } from "react";
import { getBlockDef } from "../blocks";
import { runBlock, resolveInputs } from "../execution/runScenario";
import type { BlockInstance, BlockRunResult } from "../blocks/types";
import { useRuntimeContext } from "../context/ContextStore";
import { BlockForm } from "./BlockForm";
import { ResponseViewer } from "./ResponseViewer";
import { openChairsideSocket, type SocketEvent, type SocketSession } from "../api/socket";
import { SocketEventLog } from "./SocketEventLog";

type Props = {
  block: BlockInstance;
  onChange: (next: BlockInstance) => void;
  onRunFromHere?: () => void;
};

export function BlockCard({ block, onChange, onRunFromHere }: Props) {
  const def = getBlockDef(block.kind);
  const { context, dispatch } = useRuntimeContext();
  const [result, setResult] = useState<BlockRunResult | null>(null);
  const [running, setRunning] = useState(false);
  const sessionRef = useRef<SocketSession | null>(null);
  const [events, setEvents] = useState<SocketEvent[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    return () => sessionRef.current?.disconnect();
  }, []);

  const isSocket = def.kind === "socketConnect";

  async function runHttp() {
    setRunning(true);
    const r = await runBlock(def, block, context);
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
    ? (connected ? "ok" : "idle")
    : running
      ? "running"
      : result?.status === "ok" ? "ok" : result?.status === "err" ? "err" : "idle";

  return (
    <div className="block-card">
      <header>
        <span className={`badge ${status}`}>{isSocket ? (connected ? "connected" : "idle") : status}</span>
        <h3>{def.label}</h3>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          {onRunFromHere && !isSocket && (
            <button className="btn" onClick={onRunFromHere}>Run from here</button>
          )}
          {isSocket ? (
            <button className="btn primary" onClick={connected ? disconnectSocket : connectSocket}>
              {connected ? "Disconnect" : "Connect"}
            </button>
          ) : (
            <button className="btn primary" onClick={runHttp} disabled={running}>
              {running ? "Running..." : "Run"}
            </button>
          )}
        </div>
      </header>
      <BlockForm
        def={def}
        overrides={block.overrides}
        context={context}
        onChange={(o) => onChange({ ...block, overrides: o })}
      />
      {isSocket ? <SocketEventLog events={events} /> : <ResponseViewer result={result} />}
    </div>
  );
}
