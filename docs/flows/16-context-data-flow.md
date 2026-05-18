# Flow 16 — Context & Data Flow Between Blocks

## Summary
A user runs a block that captures output into the runtime context, then uses that captured value in the next block via the "from context" checkbox. They also manually edit the context panel.

## Actors
- Authenticated user

## Preconditions
- User is signed in
- A scenario with two or more blocks exists

## Steps

### Happy Path — Automatic Context Capture
1. User runs Block 1 (e.g. GET /users/1).
2. Response body is captured: `{ id: 1, name: "Leanne Graham", ... }`.
3. Runtime context is updated; **Context** tab in right sidebar shows the captured values.
4. Block 2 has a URL input field with **From context** checkbox.
5. User checks **From context** on the URL field and selects `$.users[0].id` from the picker.
6. User runs Block 2.
7. Block 2 uses `1` as its dynamic URL parameter.

### Happy Path — Manual Context Edit
1. User opens the **Context** tab in the right sidebar.
2. User edits the JSON directly: adds `{ "myVar": "hello" }`.
3. User saves the edit.
4. Block inputs with `From context` can now reference `$.myVar`.

### Happy Path — Context Reset
1. User runs the full scenario.
2. User clicks **Reset context** in the Context panel.
3. Context is cleared to its initial state.
4. Next run starts with a clean context.

## Edge Cases
- **JSONPath resolves to undefined** → block input falls back to the literal override value.
- **Context contains circular reference** → JSON editor shows parse error.
- **From context checked but no context key exists** → block run fails with a descriptive error.

## Related Flows
- [02-api-testing-curl.md](./02-api-testing-curl.md)
- [09-graph-mode.md](./09-graph-mode.md)
- [14-nested-scenarios.md](./14-nested-scenarios.md)
