# Runbook MCP Server

Expose any Runbook bundle as MCP tools — one tool per scenario in the active version. Works with Claude Desktop, Cursor, and any MCP-compatible client.

## Quick start

```bash
# Using the standalone binary (after pnpm build)
runbook-mcp ./my-api.bundle.json

# Or via the CLI wrapper
runbook mcp ./my-api.bundle.json
```

The server runs on **stdio** transport and prints startup confirmation to stderr (so it doesn't pollute the JSON-RPC channel).

---

## Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "my-api": {
      "command": "runbook-mcp",
      "args": ["/absolute/path/to/my-api.bundle.json"]
    }
  }
}
```

If `runbook-mcp` is not on your PATH, use the full path:

```json
{
  "mcpServers": {
    "my-api": {
      "command": "/usr/local/bin/runbook-mcp",
      "args": ["/Users/you/bundles/my-api.bundle.json"]
    }
  }
}
```

Restart Claude Desktop after editing. Each scenario appears as a tool in the tool picker.

---

## Cursor

Add to `.cursor/mcp.json` in your project root (or `~/.cursor/mcp.json` globally):

```json
{
  "mcpServers": {
    "my-api": {
      "command": "runbook-mcp",
      "args": ["/absolute/path/to/my-api.bundle.json"]
    }
  }
}
```

---

## Tool naming

Each scenario `id` is sanitised to meet MCP tool name requirements (`[a-zA-Z0-9_-]+`, max 64 chars):

| Scenario ID | Tool name |
|---|---|
| `scen-register-flow` | `scen-register-flow` |
| `Register User Flow` | `Register_User_Flow` |
| `scenario/auth:login` | `scenario_auth_login` |

---

## Tool inputs

Inputs are aggregated across all blocks in the scenario. Fields that already have a static `override` set in the scenario are excluded — only the ones you need to provide at call-time appear as inputs.

Each `FieldSpec` maps to JSON Schema:

| Field type | JSON Schema type | Notes |
|---|---|---|
| `string` | `string` | |
| `password` | `string` | Treated identically to string |
| `number` | `number` | |
| `enum` | `string` with `enum` array | Values from `enumValues` |
| `json` | `object` | |

Required fields (where `required: true`) are listed in the JSON Schema `required` array.

---

## Tool output

Each tool returns a JSON text block with the following structure:

```json
{
  "scenario": "Register and login",
  "scenarioId": "scen-register",
  "blocksRun": 2,
  "success": true,
  "context": {
    "userId": "user-123",
    "authToken": "eyJ..."
  },
  "blocks": [
    {
      "blockId": "b1",
      "kind": "create-user",
      "status": "ok",
      "httpStatus": 201,
      "elapsedMs": 43,
      "response": { "data": { "id": "user-123" } },
      "captured": { "userId": "user-123" }
    },
    {
      "blockId": "b2",
      "kind": "login",
      "status": "ok",
      "httpStatus": 200,
      "elapsedMs": 38,
      "response": { "jwt": "eyJ..." },
      "captured": { "authToken": "eyJ..." }
    }
  ]
}
```

On error, `isError: true` is set and `success: false` in the body, with the failing block's `error` field populated.

---

## Progress notifications

For scenarios with many blocks, the server emits MCP progress notifications if the client provides a `progressToken`. Each block completion increments the counter.

---

## Using npx without installing

```json
{
  "mcpServers": {
    "my-api": {
      "command": "npx",
      "args": ["-y", "@runbook/mcp-server", "/path/to/bundle.json"]
    }
  }
}
```
