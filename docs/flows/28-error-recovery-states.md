# Flow 28 — Error & Recovery States

## Summary
This flow covers the key error states a user may encounter across the app and how they recover from each.

## Actors
- Authenticated user

## Error Scenarios

### 28a — Unknown Block Kind
**Trigger:** A scenario references a block kind that is not in the registry (e.g. bundle not loaded).

**UI Response:**
1. Block card renders a red alert: "Unknown block kind: `<kind>`".
2. Run button is disabled for that block.
3. User can delete the block or re-import the bundle that provides the kind.

**Recovery:** User imports the correct bundle → block kind becomes available → alert disappears.

---

### 28b — Failed HTTP Request (4xx / 5xx)
**Trigger:** Block makes an HTTP request and receives a non-2xx response.

**UI Response:**
1. Block status badge turns red.
2. HTTP status code displayed (e.g. "404 Not Found").
3. Response body still rendered in ResponseViewer.
4. Any assertions that check `status eq 200` fail.

**Recovery:** User edits the URL/headers/body and runs again.

---

### 28c — Import CORS Error
**Trigger:** OpenAPI spec or Postman URL is on a server that blocks cross-origin requests.

**UI Response:**
1. Import modal shows amber alert: "CORS error — the server does not allow browser access."
2. Suggestion to download the file and import locally.
3. No import occurs.

**Recovery:** User downloads the spec file and uses **Import from file** option.

---

### 28d — Bundle Schema Validation Error
**Trigger:** Imported bundle JSON does not match the `ProjectBundleSchema`.

**UI Response:**
1. Alert shows specific validation error (field path + message).
2. No import occurs.

**Recovery:** User fixes the bundle JSON and retries.

---

### 28e — Scenarios Loading Error
**Trigger:** Network error when fetching scenarios for the active project.

**UI Response:**
1. Red alert in the scenario list panel: "Failed to load scenarios".
2. **Retry** button available.

**Recovery:** User clicks Retry → scenarios reload.

---

### 28f — Login / Register Error
**Trigger:** Wrong credentials or server error.

**UI Response:**
1. Red alert below the form with the error message.
2. Form fields remain filled; user can correct and retry.

## Related Flows
- [02-api-testing-curl.md](./02-api-testing-curl.md)
- [03-openapi-import.md](./03-openapi-import.md)
- [07-project-management.md](./07-project-management.md)
