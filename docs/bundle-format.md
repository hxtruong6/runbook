# Bundle Format Reference

A project bundle is the single JSON file your team imports into Runbook. It contains every version of your API — blocks, scenarios, environments, and changelog — in one place.

---

## Top-level structure

```json
{
  "id": "my-project-id",
  "name": "My API",
  "description": "Optional description",
  "createdAt": "2026-05-13T00:00:00Z",
  "versions": [ /* Version objects, any order — sorted by semver automatically */ ]
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes | Stable ID — reimporting a bundle with the same `id` updates the existing project |
| `name` | string | yes | Display name shown in the project switcher |
| `description` | string | no | Short description (not currently displayed) |
| `createdAt` | ISO 8601 | yes | Creation timestamp |
| `versions` | Version[] | yes | Can be in any order — the app sorts by semver and defaults to the latest |

---

## Version

Each version is a **complete snapshot** — it carries all blocks, scenarios, and environments for that release. Not a diff.

```json
{
  "version": "2.0.0",
  "releasedAt": "2026-05-13T00:00:00Z",
  "releaseNotes": "# v2.0.0\n\nMajor release adding user management endpoints.",
  "changes": [ /* ChangeEntry objects */ ],
  "blocks": [ /* BlockDefData objects */ ],
  "scenarios": [ /* Scenario objects */ ],
  "environments": [ /* Environment objects */ ],
  "docs": {
    "overview": "# Overview\nMarkdown documentation for this version."
  }
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `version` | string | yes | Semver string: `"1.0"`, `"1.2.3"`, `"2.0.0"` |
| `releasedAt` | ISO 8601 | yes | Release date |
| `releaseNotes` | string | yes | Markdown shown in the **What's New** tab. Can be empty string. |
| `changes` | ChangeEntry[] | yes | Structured changelog entries |
| `blocks` | BlockDefData[] | yes | All API block definitions for this version |
| `scenarios` | Scenario[] | yes | Pre-built scenario flows |
| `environments` | Environment[] | yes | Default environment configs |
| `docs` | Record\<string, string\> | yes | Keyed markdown documents shown in What's New. Use `{}` if none. |

**Versioning convention:** put all versions in any order — the app auto-sorts by semver and defaults to the highest version. To release v2.0 just add it to the `versions` array alongside v1.x.

---

## ChangeEntry

```json
{ "type": "added",      "target": "create-user", "summary": "New endpoint for user creation", "breaking": false }
{ "type": "modified",   "target": "login",        "summary": "Response now includes refresh token" }
{ "type": "deprecated", "target": "old-auth",     "summary": "Use login instead", "removeBy": "3.0.0" }
{ "type": "removed",    "target": "legacy-api",   "summary": "Removed after deprecation in 1.x", "breaking": true }
{ "type": "fixed",      "target": "get-profile",  "summary": "Fixed 401 on expired sessions" }
{ "type": "note",                                  "summary": "Minimum API server version is now 4.2" }
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `type` | enum | yes | `added` / `modified` / `deprecated` / `removed` / `fixed` / `note` |
| `target` | string | no | Block kind or feature this change applies to |
| `summary` | string | yes | One-line description shown in the changelog |
| `breaking` | boolean | no | Shown as a red BREAKING badge |
| `removeBy` | string | no | Target version for removal of deprecated items |

---

## API Block (`BlockDefData`)

```json
{
  "kind": "create-user",
  "label": "Create User",
  "auth": "jwt",
  "inputs": [
    { "name": "email",    "label": "Email",    "type": "string",   "required": true },
    { "name": "password", "label": "Password", "type": "password", "required": true },
    { "name": "role",     "label": "Role",     "type": "enum",     "enumValues": ["admin", "user"] }
  ],
  "outputs": [
    { "jsonPath": "$.data.id",    "contextKey": "userId" },
    { "jsonPath": "$.data.token", "contextKey": "authToken" }
  ],
  "request": {
    "method": "POST",
    "urlTemplate": "/api/users",
    "headers": {
      "Authorization": "Bearer {{authToken}}",
      "Content-Type": "application/json"
    },
    "query": {},
    "bodyTemplate": {
      "email": "{{email}}",
      "password": "{{password}}",
      "role": "{{role}}"
    }
  }
}
```

### Top-level fields

| Field | Type | Required | Notes |
|---|---|---|---|
| `kind` | string | yes | Unique identifier. Used in scenarios as `blockInstance.kind`. Two blocks with the same `kind` — the local one wins over the bundle. |
| `label` | string | yes | Human-readable name shown in the UI |
| `auth` | `"none"` / `"jwt"` / `"cookie-or-jwt"` | yes | The runtime injects auth credentials automatically based on the active environment |
| `inputs` | FieldSpec[] | yes | Fields the user configures per block usage |
| `outputs` | OutputSpec[] | yes | Values extracted from the response and stored in the run context |
| `request` | RequestDef | yes | HTTP request definition |

### FieldSpec

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | string | yes | Internal key. Used in `{{name}}` tokens in the request. |
| `label` | string | yes | Shown next to the input field |
| `type` | `"string"` / `"password"` / `"number"` / `"enum"` / `"json"` | yes | Controls the input UI |
| `required` | boolean | no | Block will warn if this is empty at run time |
| `fromContextKey` | string | no | Auto-populates the field from this context key if present |
| `enumValues` | string[] | no | Required when `type` is `"enum"` |
| `placeholder` | string | no | Placeholder text |

### OutputSpec

| Field | Type | Required | Notes |
|---|---|---|---|
| `jsonPath` | string | yes | JSONPath expression into the response body, e.g. `$.data.id` |
| `contextKey` | string | yes | Name under which the extracted value is stored. Later blocks can reference it via `{{contextKey}}` or `fromContextKey`. |

### RequestDef

| Field | Type | Required | Notes |
|---|---|---|---|
| `method` | `"GET"` / `"POST"` / `"PUT"` / `"DELETE"` | yes | HTTP method |
| `urlTemplate` | string | yes | Path appended to the environment's `baseUrl`. Supports `{{tokens}}`. |
| `headers` | Record\<string, string\> | no | Per-request headers. Values support `{{tokens}}`. |
| `query` | Record\<string, string\> | no | Query parameters. Empty/undefined values are omitted. |
| `bodyTemplate` | any JSON | no | Request body. Only sent for POST/PUT. Supports nested `{{tokens}}`. |

### `{{token}}` substitution rules

Tokens are resolved from the merged set of: user-provided input overrides → run context values.

- **Whole-string token** `"{{userId}}"` — substitutes the original value as-is. A number stays a number in the body.
- **Inline token** `"/users/{{userId}}/posts"` — string-interpolated; all tokens become strings.
- **Object/array bodies** — walked recursively. Keys whose resolved value is `undefined` are omitted from the body.

---

## Environment

```json
{
  "id": "env-staging",
  "name": "Staging",
  "baseUrl": "https://staging.api.example.com",
  "auth": { "kind": "bearer", "token": "" },
  "headers": { "X-App-Version": "2" },
  "createdAt": "2026-05-13T00:00:00Z"
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes | Unique ID |
| `name` | string | yes | Display name, e.g. `Staging`, `Production` |
| `baseUrl` | URL string | yes | Prepended to every `urlTemplate` |
| `auth` | AuthConfig | yes | Auth strategy for all requests in this environment |
| `headers` | Record\<string, string\> | yes | Headers added to every request. Use `{}` if none. |
| `createdAt` | ISO 8601 | yes | Creation timestamp |

### AuthConfig variants

```json
{ "kind": "bearer", "token": "eyJ..." }
{ "kind": "cookie", "token": "session=abc" }
{ "kind": "apiKey", "in": "header", "name": "X-Api-Key", "value": "secret" }
{ "kind": "apiKey", "in": "query",  "name": "api_key",   "value": "secret" }
{ "kind": "basic",  "username": "admin", "password": "pass" }
{ "kind": "none" }
```

---

## Scenario

```json
{
  "id": "scen-register-flow",
  "name": "Register and login",
  "createdAt": "2026-05-13T00:00:00Z",
  "reusable": false,
  "blocks": [
    { "id": "bi-1", "kind": "create-user", "overrides": { "role": "admin" } },
    { "id": "bi-2", "kind": "login",       "overrides": {} }
  ]
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes | Unique ID |
| `name` | string | yes | Display name |
| `createdAt` | ISO 8601 | yes | Creation timestamp |
| `reusable` | boolean | no | If `true`, this scenario can be used as a `scenario-ref` block inside other flows |
| `blocks` | BlockInstance[] | yes | Ordered list of block usages |
| `graphData` | GraphData | no | Graph layout — present only when the scenario has been opened in graph mode |

### BlockInstance

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes | Unique within the scenario |
| `kind` | string | yes | Must match a `kind` in the block registry |
| `overrides` | Record\<string, unknown\> | yes | Input values that override defaults. Use `{}` if none. |

---

## Complete multi-version example

```json
{
  "id": "project-a",
  "name": "Project A",
  "createdAt": "2026-01-01T00:00:00Z",
  "versions": [
    {
      "version": "2.0",
      "releasedAt": "2026-05-01T00:00:00Z",
      "releaseNotes": "## v2.0\n\nAdded user management. Breaking change to auth response.",
      "changes": [
        { "type": "added",    "target": "create-user", "summary": "New user creation endpoint" },
        { "type": "added",    "target": "delete-user", "summary": "New user deletion endpoint" },
        { "type": "modified", "target": "login",       "summary": "Response now includes refreshToken", "breaking": true }
      ],
      "blocks": [ /* 7 blocks */ ],
      "scenarios": [],
      "environments": [],
      "docs": {}
    },
    {
      "version": "1.1",
      "releasedAt": "2026-03-01T00:00:00Z",
      "releaseNotes": "## v1.1\n\nMinor fix to login endpoint.",
      "changes": [
        { "type": "fixed", "target": "login", "summary": "Fixed 401 on token expiry" }
      ],
      "blocks": [ /* 5 blocks */ ],
      "scenarios": [],
      "environments": [],
      "docs": {}
    },
    {
      "version": "1.0",
      "releasedAt": "2026-01-01T00:00:00Z",
      "releaseNotes": "## v1.0\n\nInitial release.",
      "changes": [],
      "blocks": [ /* 5 blocks */ ],
      "scenarios": [],
      "environments": [],
      "docs": {}
    }
  ]
}
```

The app sorts by semver automatically — v2.0 will be the default regardless of array order.
