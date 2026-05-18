# Flow 15 — Block Assertions & Validation

## Summary
A user adds assertions to a block, runs the scenario, and inspects per-assertion pass/fail results.

## Actors
- Authenticated user

## Preconditions
- User is signed in
- A scenario with at least one `httpRequest` block exists

## Steps

### Happy Path — Add Assertion
1. User opens the **⋯** menu on a block card.
2. User clicks **Edit assertions**.
3. JSON editor modal opens with an empty assertions array.
4. User adds an assertion:
   ```json
   [{ "path": "status", "op": "eq", "value": 200 }]
   ```
5. User clicks **Save**.
6. Assertion badge appears on the block card.

### Happy Path — Run with Passing Assertion
1. User clicks **Run** on the block.
2. Response returns HTTP 200.
3. Assertion result badge shows green "1/1 passed".

### Happy Path — Run with Failing Assertion
1. User edits the assertion value to `201`.
2. User runs the block again.
3. Assertion result badge shows red "0/1 passed".
4. Tooltip or expand shows which assertion failed and the actual vs expected values.

### Happy Path — Multiple Assertions
1. User adds three assertions (status, body.id exists, body.name contains "John").
2. Runs the block.
3. Results show per-assertion pass/fail badges.

## Edge Cases
- **Invalid assertion JSON** → editor shows parse error; save blocked.
- **Path not found in response** → assertion using `exists` op fails gracefully.
- **No assertions defined** → no badge shown on block card.
- **Assertion on non-HTTP block** → not applicable; assertion UI not shown.

## Related Flows
- [02-api-testing-curl.md](./02-api-testing-curl.md)
- [08-burst-runner.md](./08-burst-runner.md)
