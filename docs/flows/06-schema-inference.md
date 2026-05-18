# Flow 06 — Schema Inference

## Summary
A user runs a block and the app captures the response schema. The user views the inferred schema. On a subsequent run with a different shape, schema drift is detected.

## Actors
- Authenticated user

## Preconditions
- User is signed in
- A scenario with at least one `httpRequest` block exists

## Steps

### Happy Path — Initial Capture
1. User runs a block that returns a JSON response.
2. `InferenceBanner` appears below the block: "Response schema captured".
3. User clicks **View schema**.
4. `InferenceModal` opens showing the inferred JSON schema.
5. User clicks **Apply** to lock the schema.
6. Schema stored in `runbook:inference` under the block's kind key.
7. User reloads → schema is still present (badge count in sidebar persists).

### Happy Path — Schema Drift
1. User modifies the request to hit a different endpoint with a different response shape.
2. User runs the block again.
3. `InferenceBanner` changes to amber: "Schema drift detected".
4. User opens the modal → diff view shows added/removed/changed fields.
5. User clicks **Apply** to update the stored schema.

### Happy Path — Disable Inference
1. User opens the TopBar **More actions** menu.
2. User toggles **Inference** off.
3. Subsequent block runs do not show the inference banner.

## Edge Cases
- **Non-JSON response** → no schema captured; banner does not appear.
- **Empty response body** → schema captured as `{}`.
- **First run** → no previous schema; no diff shown; just the new schema.
- **Block kind not in registry** → inference not captured.

## Key State
| Key | Value |
|-----|-------|
| `runbook:inference` | `{ [blockKind]: JSONSchema }` |

## Related Flows
- [02-api-testing-curl.md](./02-api-testing-curl.md)
- [15-block-assertions.md](./15-block-assertions.md)
