# CLI Auth, Profiles & Multi-Team Design

**Date:** 2026-05-14  
**Status:** Approved

---

## Problem

The existing CLI requires `--token <jwt>` on every command. There is no `runbook login`, no way to persist credentials, no concept of multiple servers or teams. This makes the CLI impractical for daily use and blocks multi-team workflows.

---

## Solution

A profile-based auth system (modelled after `kubectl` contexts and `gh auth`) backed by a local config file. Each profile stores a server URL, JWT token, email, and default teamId. All commands read from the active profile by default and accept `--profile` to override.

---

## Config File

Location: `~/.config/runbook/config.json`

```json
{
  "currentProfile": "default",
  "profiles": {
    "default": {
      "server": "http://localhost:3001",
      "token": "eyJ...",
      "email": "you@example.com",
      "teamId": "abc123"
    },
    "work": {
      "server": "https://runbook.company.com",
      "token": "eyJ...",
      "email": "you@company.com",
      "teamId": "xyz789"
    }
  }
}
```

The config module (`packages/cli/src/config.ts`) handles all reads and writes. It is the single source of truth for credentials in the CLI. No command reads the config file directly — they all go through this module.

---

## New CLI Commands

### `runbook login`

```
runbook login [--server <url>] [--profile <name>]
```

Interactive prompts for server URL (default: `http://localhost:3001`), email, and password. POSTs to `/auth/login`, stores the returned JWT in the named profile (default: `default`). Prints confirmation with email and server.

If `--server` is provided, skips the server prompt. Useful for scripted onboarding.

### `runbook logout`

```
runbook logout [--profile <name>]
```

Clears the token from the named profile. Keeps server and email so `runbook login` can re-authenticate without re-entering them.

### `runbook whoami`

```
runbook whoami [--profile <name>]
```

Prints the current profile's server, email, teamId (or "none"), and a masked token preview (`eyJ...abc`). No network call — reads from config only.

### `runbook profile list`

```
runbook profile list
```

Lists all saved profiles with their server and email. Marks the active profile with `*`.

### `runbook profile use <name>`

```
runbook profile use <name>
```

Switches `currentProfile` to `<name>`. Errors if profile does not exist.

### `runbook team list`

```
runbook team list [--profile <name>]
```

Calls `GET /teams` on the server using the profile's token. Prints team IDs and names.

### `runbook team use <teamId>`

```
runbook team use <teamId> [--profile <name>]
```

Sets the `teamId` field in the named profile. No network call — just updates config.

---

## Updated Existing Commands

### `runbook publish`

Old: `runbook publish <file> --server <url> --token <jwt>`  
New: `runbook publish <file> [--profile <name>] [--server <url>] [--token <jwt>]`

`--server` and `--token` are now optional. If not provided, they are read from the active profile. Explicit flags always win over profile values. If no token is available (neither flag nor profile), exits with a clear error: `"Not logged in. Run: runbook login"`.

### `runbook install`

Old: `runbook install <bundleId> --server <url>`  
New: `runbook install <bundleId> [--profile <name>] [--server <url>] [--output <file>]`

`--server` is now optional, read from active profile. Install is public (no token needed), so no auth change.

---

## Environment Variable Overrides (CI/CD)

All commands respect these env vars, which take precedence over profile values but are overridden by explicit flags:

| Var | Overrides |
|---|---|
| `RUNBOOK_SERVER` | profile server |
| `RUNBOOK_TOKEN` | profile token |
| `RUNBOOK_TEAM` | profile teamId |
| `RUNBOOK_PROFILE` | currentProfile |

This lets CI pipelines authenticate without touching the config file:
```bash
RUNBOOK_SERVER=https://registry.example.com \
RUNBOOK_TOKEN=$CI_TOKEN \
runbook publish bundle.json
```

---

## Web UI: Token Copy Button

A user menu in `TopBar` (top-right corner) replaces the current bare `IconDots` menu. It shows the logged-in user's email and a **Copy token** menu item that copies the JWT to clipboard. A tooltip explains it's for CLI use.

The token is already in `useAuthStore().token` — no new API calls needed.

---

## CLI README

`packages/cli/README.md` covering:
- Installation (`pnpm build` + `node dist/index.js` or link globally)
- Quick start: `runbook login` → `runbook publish` → `runbook install`
- Profile management for multiple servers/teams
- CI/CD env var pattern
- All commands with flags

---

## File Map

**New CLI files:**
- `packages/cli/src/config.ts` — config read/write module
- `packages/cli/src/commands/login.ts`
- `packages/cli/src/commands/logout.ts`
- `packages/cli/src/commands/whoami.ts`
- `packages/cli/src/commands/profile.ts` — `list` and `use` sub-commands
- `packages/cli/src/commands/team.ts` — `list` and `use` sub-commands
- `packages/cli/README.md`

**Modified CLI files:**
- `packages/cli/src/index.ts` — register new commands
- `packages/cli/src/commands/publish.ts` — read server/token from profile
- `packages/cli/src/commands/install.ts` — read server from profile

**New Web files:**
- `apps/web/src/components/UserMenu.tsx` — user menu with Copy token item

**Modified Web files:**
- `apps/web/src/components/TopBar.tsx` — replace bare dots menu with UserMenu

---

## Non-Goals

- OAuth / browser-based login flow (email+password is sufficient for now)
- Token refresh (JWTs are long-lived in the current server config)
- Encrypted config file (the token is stored in plaintext, consistent with `gh` and `fly` behaviour)
- `runbook profile delete` (out of scope — users can edit the JSON directly)
