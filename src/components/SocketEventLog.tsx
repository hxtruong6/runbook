// src/components/SocketEventLog.tsx
import type { SocketEvent } from "../api/socket";

export function SocketEventLog({ events }: { events: SocketEvent[] }) {
  if (events.length === 0) return <p style={{ fontSize: 12, opacity: 0.6 }}>No events yet.</p>;
  return (
    <div>
      {events.map((e, i) => (
        <pre key={i} className="response" style={{ marginTop: 6 }}>
          {e.receivedAt}{"\n"}
          {JSON.stringify(e.payload, null, 2)}
        </pre>
      ))}
    </div>
  );
}
