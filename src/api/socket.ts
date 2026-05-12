// src/api/socket.ts
import { io, type Socket } from "socket.io-client";
import { getBaseUrl } from "./config";

export type SocketEvent = {
  receivedAt: string;
  payload: unknown;
};

export type SocketSession = {
  socket: Socket;
  events: SocketEvent[];
  subscribe: (cb: (events: SocketEvent[]) => void) => () => void;
  disconnect: () => void;
};

export function openChairsideSocket(opts: {
  userId: string;
  role: string;
  orthoReviewId: string;
  ownSocketSessionUuid: string;
}): SocketSession {
  const socket = io(getBaseUrl(), {
    path: "/chat",
    query: { userId: opts.userId, role: opts.role },
    withCredentials: true,
    transports: ["websocket", "polling"],
  });

  const events: SocketEvent[] = [];
  const listeners = new Set<(events: SocketEvent[]) => void>();
  const notify = () => listeners.forEach((cb) => cb([...events]));

  socket.on("connect", () => {
    socket.emit("join_chairside_session", { sessionId: opts.orthoReviewId });
  });

  socket.on("chairside_session_update", (payload: any) => {
    if (payload?.socketSessionUuid && payload.socketSessionUuid === opts.ownSocketSessionUuid) {
      return; // echo suppression
    }
    events.push({ receivedAt: new Date().toISOString(), payload });
    notify();
  });

  return {
    socket,
    events,
    subscribe(cb) {
      listeners.add(cb);
      cb([...events]);
      return () => listeners.delete(cb);
    },
    disconnect() {
      socket.disconnect();
    },
  };
}
