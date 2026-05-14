# @runbook/cli

Runbook command-line interface — publish and install API workflow bundles, manage profiles and teams.

## Installation

```bash
# From the monorepo root
pnpm --filter @runbook/cli build
# Link globally (optional)
npm link packages/cli
```

## Quick Start

```bash
# 1. Log in (creates a "default" profile)
runbook login

# 2. Set your default team
runbook team list
runbook team use <teamId>

# 3. Publish a bundle
runbook publish my-api.bundle.json

# 4. Install a bundle from the registry
runbook install my-api-bundle-id
```

## Authentication

Credentials are stored in `~/.config/runbook/config.json`.

```bash
runbook login                          # interactive, saves to "default" profile
runbook login --server https://... --profile work
runbook logout                         # clear token for active profile
runbook whoami                         # show current profile info
```

## Multiple Profiles (Multiple Servers / Accounts)

```bash
runbook profile list                   # list all profiles (* = active)
runbook profile use work               # switch active profile
```

Each profile stores its own server URL, token, and default team.

## Team Management

```bash
runbook team list                      # list teams for current user
runbook team use <teamId>              # set default team in active profile
runbook team list --profile work       # use a specific profile
```

## Publishing

```bash
runbook publish bundle.json
runbook publish bundle.json --profile work
runbook publish bundle.json --server http://localhost:3001 --token eyJ...
```

## Installing

```bash
runbook install my-bundle-id
runbook install my-bundle-id --output ./downloads/bundle.json
runbook install my-bundle-id --profile work
```

The install command verifies the SHA-256 hash of the downloaded bundle before saving.

## CI/CD — Environment Variables

Skip the config file entirely in pipelines:

```bash
export RUNBOOK_SERVER=https://registry.example.com
export RUNBOOK_TOKEN=$CI_JWT_TOKEN
export RUNBOOK_TEAM=$TEAM_ID

runbook publish dist/bundle.json
```

| Variable | Overrides |
|---|---|
| `RUNBOOK_SERVER` | profile server URL |
| `RUNBOOK_TOKEN` | profile token |
| `RUNBOOK_TEAM` | profile teamId |
| `RUNBOOK_PROFILE` | active profile name |

## Web UI — Copy Token

If you're logged in via the browser, click the user icon (top-right) → **Copy token** to copy your JWT for use with the CLI.
