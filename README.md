<div align="center">

<img src="docs/assets/banner.png" alt="Runbook — the versioned, runnable API integration kit" width="820" />

### The versioned, runnable API integration kit.

**Build flows from reusable API blocks. Ship them to your team as a single JSON bundle. Stay in sync as APIs change.**

[Quick start](#quick-start) · [Web app](#1-web-app-appsweb) · [CLI](#2-cli-packagescli) · [MCP server](#3-mcp-server-packagesmcp-server) · [Marketing site](#4-marketing-site-appsmarketing) · [Roadmap](#roadmap) · [Investor pitch](PITCH.md)

<sub>Local-first · TypeScript · React · Mantine · Fastify · Astro · MCP</sub>

</div>

---

## What's in this repo

Runbook is a pnpm monorepo. Each piece can be used on its own:

| Path | What it is | When you'd use it |
|---|---|---|
| `apps/web` | The Runbook studio — React + Mantine SPA. Author, run, and share bundles in your browser. | Day-to-day authoring. Works fully offline against `localStorage`. |
| `apps/server` | **Optional** Fastify + MongoDB backend. Login, teams, registry, share links. | Only when you want accounts, team sync, or a public registry. |
| `apps/marketing` | Astro static site (the runbook.app landing page). | Marketing only. |
| `packages/shared` | Zod schemas + the bundle runtime (block resolver, fetcher, scenario runner). | Source of truth shared by every other package. |
| `packages/cli` | `runbook` CLI — `init`, `validate`, `run`, `diff`, `login`, `publish`, `install`, `mcp`. | Headless validation, CI checks, running scenarios from a terminal. |
| `packages/mcp-server` | Exposes any bundle as a Model Context Protocol toolset. | Letting AI agents (Claude, Cursor, etc.) call your APIs. |

> **Local-first.** The web app, CLI, and MCP server all run without `apps/server`. You only need the backend for login, teams, publishing to the public registry, and shareable run links.

---

## Quick start

```bash
git clone git@github.com:hxtruong6/runbook.git
cd runbook
pnpm install
pnpm dev          # web app on http://localhost:3000
```

Open the URL, pick a sample bundle from the gallery, and click **Run**. You don't need an account.

### Common workspace commands

```bash
pnpm build        # build every package
pnpm -r test      # vitest across all packages (currently 737 / 737 passing)
pnpm lint         # ESLint — enforces the design-system rules in CLAUDE.md
```

---

## The four pieces, in detail

### 1. Web app (`apps/web`)

The studio. React + Mantine, persisted to `localStorage`.

```bash
pnpm --filter @runbook/web dev      # http://localhost:3000
pnpm --filter @runbook/web build
pnpm --filter @runbook/web test
```

**What you can do without any backend:**
- Paste a `curl` snippet → instant runnable block
- Import an **OpenAPI** spec or **Postman v2.1** collection → full bundle
- Compose blocks into linear scenarios or a branching **graph**
- Switch environments (staging ↔ prod) with one click
- Run scenarios in your browser; inspect the captured context between steps
- Export the project as a single `runbook.json` bundle
- View `?bundle=<url>` to load any public bundle on the fly (the "Run in Runbook" badge)

**What needs the backend** (`apps/server`): login, teams, publishing to the registry, shareable `/s/<slug>` run links.

> The design system lives in [`apps/web/src/theme.ts`](apps/web/src/theme.ts). ESLint blocks hex literals, off-palette color names, and magic numbers in inline styles. See [`CLAUDE.md`](CLAUDE.md).

### 2. CLI (`packages/cli`)

Install once, use anywhere a terminal lives — CI, scripts, MCP servers.

```bash
pnpm --filter @runbook/cli build
# Then either `npm link` it, or alias:
alias rb="node $(pwd)/packages/cli/dist/index.js"
```

**Scaffold a new runbook in a fresh directory:**
```bash
rb init my-runbook
cd my-runbook
ls   # runbook.json  README.md  .github/workflows/validate-bundle.yml
```

**Day-to-day:**
```bash
rb validate runbook.json          # schema check (use in CI)
rb run runbook.json smoke --json  # execute a scenario, get JSON results
rb diff runbook.json runbook.v2.json  # human-readable bundle diff
```

**With the backend running:**
```bash
rb login              # opens browser-based flow
rb whoami
rb publish runbook.json
rb install <slug>     # fetch a published bundle
rb logout
```

**Expose a bundle to AI agents (see MCP section):**
```bash
rb mcp runbook.json
```

### 3. MCP server (`packages/mcp-server`)

Turns a Runbook bundle into a [Model Context Protocol](https://modelcontextprotocol.io) toolset. Every scenario becomes a callable tool. AI agents can run your real API flows.

**Wire into Claude Code (`.mcp.json` or `~/.claude.json`):**

```json
{
  "mcpServers": {
    "my-runbook": {
      "command": "node",
      "args": [
        "/abs/path/to/runbook/packages/cli/dist/index.js",
        "mcp",
        "/abs/path/to/runbook.json"
      ]
    }
  }
}
```

Restart Claude Code → `/mcp` should list `my-runbook` with one tool per scenario.

**Quick sanity probe without a client:**
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"probe","version":"0"}}}
{"jsonrpc":"2.0","method":"notifications/initialized"}
{"jsonrpc":"2.0","id":2,"method":"tools/list"}' \
  | rb mcp ./runbook.json
```

### 4. Marketing site (`apps/marketing`)

Static Astro site for runbook.app — landing page only, no app logic.

```bash
pnpm --filter marketing dev       # http://localhost:4321
pnpm --filter marketing build
pnpm --filter marketing preview   # serve the built dist/
```

### Optional: backend (`apps/server`)

Fastify + MongoDB + Socket.io. Only needed for accounts, teams, registry, and share links.

```bash
# Start MongoDB locally first, then:
pnpm --filter @runbook/server dev   # http://localhost:3001
```

Environment: copy `apps/server/.env.example` → `.env` and fill in `MONGO_URL`, `JWT_SECRET`.

---

## Core primitives

- **API Block** — A reusable HTTP request template. Inputs (user-supplied fields), request shape (method, URL, headers, body — all with `{{token}}` interpolation), outputs (JSONPath extractors that feed the run context).
- **Scenario** — An ordered list of blocks with per-step overrides. Scenarios can embed other scenarios as `scenario-ref` blocks.
- **Graph** — Visual node/edge editor for branching flows. Same scenario, two views.
- **Environment** — Base URL + auth (bearer, cookie, API key, basic). Switch staging ↔ production with one click.
- **Project Bundle** — A single `runbook.json` containing every version of a project. Consumers pick a version; switching is instant. See [`docs/bundle-format.md`](docs/bundle-format.md).

---

## Why Runbook

| | Postman / Bruno | Internal scripts | **Runbook** |
|---|---|---|---|
| Reusable building blocks | Collections (flat) | Copy-paste | **Typed blocks with inputs/outputs** |
| Branching flows | Limited | Hand-rolled | **Native graph mode** |
| Versioned distribution | Workspace sync | Git, manually | **Self-contained bundle, semver-aware** |
| Embeddable in your docs | No | No | **One-click "Run in Runbook" badge** |
| Local-first | Account required | N/A | **Works without an account** |
| AI-agent ready | No | No | **MCP server out of the box** |
| Author/consumer separation | Weak | None | **Bundles are the contract** |

---

## Roadmap

Shipped:
- [x] Browser-first runtime, `localStorage` persistence
- [x] Versioned bundles with semver-aware version switcher
- [x] Graph mode with branching flows
- [x] Shared Zod schemas, Fastify backend, Socket.io live runs
- [x] **CLI** — `init`, `validate`, `run`, `diff`, `login`, `publish`, `install`, `mcp`
- [x] **OpenAPI** → blocks importer
- [x] **Postman v2.1** → blocks importer
- [x] **`curl` paste** → block
- [x] **GitHub integration** — bundle-as-repo workflow, CI validation
- [x] **MCP server** — expose any bundle as a tool surface for AI agents
- [x] **Shareable run links** with secret redaction
- [x] **"Run in Runbook" embed badge**
- [x] **Public bundle gallery**
- [x] Command palette, onboarding tour, mobile-readable run views

Next:
- [ ] Browser extension — capture from the Network tab into a block
- [ ] AI block generation from natural language
- [ ] Hosted team workspaces (RBAC, run history, audit logs)
- [ ] Bundle signing & paid registry tier

Full plan with priorities and acceptance criteria: [`docs/growth-roadmap.md`](docs/growth-roadmap.md).

---

## Documentation

- [`docs/bundle-format.md`](docs/bundle-format.md) — complete bundle JSON schema
- [`docs/mcp.md`](docs/mcp.md) — how the MCP server exposes scenarios
- [`docs/growth-roadmap.md`](docs/growth-roadmap.md) — full feature roadmap with status
- [`CLAUDE.md`](CLAUDE.md) — engineering conventions, design-system rules
- **Schema tab** in the running app — interactive field reference with examples

---

## Team & contact

Building Runbook out of 32CO.

- **Investment / partnership** — [hxtruong6@gmail.com](mailto:hxtruong6@gmail.com)
- **Design partners** — [open an issue](https://github.com/hxtruong6/runbook/issues/new) tagged `design-partner`
- **Deep dive** — [PITCH.md](PITCH.md) covers the problem, market, GTM, and ask

---

<div align="center">
<sub>Runbook — version your APIs the way you version your code.</sub>
</div>
