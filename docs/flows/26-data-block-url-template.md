# Flow 26 — Data Block & URL Template Block

## Summary
A user creates a Data block to define reusable variables, then wires those variables into a URL Template block, and runs the chain to confirm dynamic URL construction.

## Actors
- Authenticated user

## Preconditions
- User is signed in
- An active scenario exists

## Steps

### Happy Path
1. User clicks **Add block** → selects **Data** from the built-in blocks list.
2. `dataBlock` card appears with a JSON editor for key-value pairs.
3. User enters:
   ```json
   { "userId": 42, "region": "us-east" }
   ```
4. User clicks **Add block** again → selects **URL Template**.
5. `urlTemplate` card appears with a template input.
6. User enters: `https://api.example.com/{{region}}/users/{{userId}}`
7. User runs the scenario.
8. Data block outputs `{ userId: 42, region: "us-east" }` into context.
9. URL Template block resolves to `https://api.example.com/us-east/users/42`.
10. Resolved URL is visible in the block card output.

## Edge Cases
- **Template variable not in context** → unresolved `{{variable}}` remains; warning shown.
- **Invalid JSON in data block** → editor shows parse error; run blocked.
- **Numeric variable in string template** → coerced to string correctly.

## Related Flows
- [16-context-data-flow.md](./16-context-data-flow.md)
- [02-api-testing-curl.md](./02-api-testing-curl.md)
