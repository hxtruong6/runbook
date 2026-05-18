# Flow 02 — API Testing via cURL Paste

## Summary
A signed-in user creates a new scenario, pastes a cURL command to generate a block, runs it, and inspects the response.

## Actors
- Authenticated user with at least one project

## Preconditions
- User is signed in
- At least one project exists

## Steps

### Happy Path
1. User opens the **Scenarios** sidebar tab.
2. User clicks **+** to create a new scenario → "Untitled scenario" is added and selected.
3. User clicks the **Add block** menu at the bottom of the empty scenario.
4. User selects **Paste cURL**.
5. `PasteCurlModal` opens with a textarea.
6. User pastes: `curl -X GET 'https://jsonplaceholder.typicode.com/users/1'`
7. User clicks **Add block**.
8. Block is parsed → method `GET`, URL extracted, headers populated.
9. A new `httpRequest` BlockCard appears in the scenario.
10. User clicks **Run** on the block card.
11. Block executes; HTTP 200 response renders in the ResponseViewer.
12. Status badge turns teal (ok).
13. Elapsed time is displayed.
14. Response body (JSON) is displayed in the ResponseViewer.

## Edge Cases
- **Invalid cURL syntax** → error alert in modal; block not added.
- **Network request fails (offline)** → block status turns red; error message displayed.
- **4xx / 5xx response** → status badge turns red; response body still rendered.
- **Empty textarea on submit** → modal shows validation message.

## Key State
- New `Scenario` persisted in `runbook:scenarios`.
- `BlockInstance` with kind `httpRequest` added to scenario.
- Run result visible in block card (not persisted between sessions by default).

## Related Flows
- [04-block-library.md](./04-block-library.md)
- [06-schema-inference.md](./06-schema-inference.md)
- [15-block-assertions.md](./15-block-assertions.md)
