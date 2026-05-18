# Flow 27 — Socket Connect Block

## Summary
A user adds a Socket Connect block to a scenario, connects to a WebSocket endpoint, and views the real-time event log.

## Actors
- Authenticated user

## Preconditions
- User is signed in
- An active scenario exists
- A WebSocket server endpoint is available

## Steps

### Happy Path
1. User clicks **Add block** → selects **Socket Connect** from built-in blocks.
2. `socketConnect` block card appears with:
   - URL input (WebSocket endpoint)
   - Optional headers
3. User enters `wss://echo.websocket.org`.
4. User clicks **Run**.
5. WebSocket connection is established.
6. `SocketEventLog` component appears within the block card.
7. Connection event appears: "Connected".
8. Incoming messages appear in the log with timestamps.
9. User sends a test message via a text input in the block.
10. Echo response appears in the log.
11. User clicks **Disconnect**.
12. "Disconnected" event logged.

## Edge Cases
- **Invalid WebSocket URL** → connection error logged; block status turns red.
- **Server rejects connection** → error shown with status code.
- **Connection timeout** → timeout error logged.
- **Large volume of messages** → log auto-scrolls; older messages accessible by scrolling up.

## Related Flows
- [02-api-testing-curl.md](./02-api-testing-curl.md)
- [16-context-data-flow.md](./16-context-data-flow.md)
