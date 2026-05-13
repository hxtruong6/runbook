<div align="center">

<img src="docs/assets/banner.png" alt="Runbook — the versioned, runnable API integration kit" width="820" />

### The versioned, runnable API integration kit.

**Build flows from reusable API blocks. Ship them to your team as a single JSON bundle. Stay in sync as APIs change.**

[Quick start](#quick-start) · [Why Runbook](#why-runbook) · [How it works](#how-it-works) · [Roadmap](#roadmap) · [Investor pitch](PITCH.md)

<sub>TypeScript · React · Mantine · Fastify · Socket.io · Zod</sub>

</div>

---

## Screenshots

> Drop product screenshots into `docs/assets/` to populate this section:
>
> - `docs/assets/graph-mode.png` — graph editor with a multi-step flow
> - `docs/assets/scenario-run.png` — scenario mid-run with context values
> - `docs/assets/version-switcher.png` — bundle version dropdown showing release notes

---

## The problem

Every engineering org rebuilds the same thing: a Postman collection here, a Bruno workspace there, a Notion page of curl commands, a Python script in a dusty repo. None of them are versioned with the APIs they call. None of them ship between teams as a single artifact. When the API changes, everyone's local copy quietly rots.

The result: onboarding takes weeks, partner integrations break silently, and the "source of truth" for how to call an API lives in tribal knowledge.

## The solution

**Runbook is a portable, versioned runtime for API workflows.**

- **Author once** — define an API call as a reusable *block* with typed inputs, templated requests, and structured outputs.
- **Compose** — chain blocks into *scenarios* (linear or graph), pass values between them, branch on success/error.
- **Distribute** — export the entire project (blocks + scenarios + environments + release notes) as a single signed JSON *bundle*.
- **Evolve** — every bundle carries all historical versions. Consumers pick a version; switching is one click. Diffs are explicit, not implicit.

Think of it as `package.json` + `npm` + Postman, collapsed into one artifact that an API provider ships to its consumers.

## Why Runbook

| | Postman / Bruno | Internal scripts | **Runbook** |
|---|---|---|---|
| Reusable building blocks | Collections (flat) | Copy-paste | **Typed blocks with inputs/outputs** |
| Branching flows | Limited | Hand-rolled | **Native graph mode** |
| Versioned distribution | Workspace sync | Git, manually | **Self-contained bundle, semver-aware** |
| Multi-environment | Yes | DIY | **First-class environments** |
| Embeddable in apps | No | No | **Browser-first, zero backend required** |
| Author/consumer separation | Weak | None | **Bundles are the contract** |

## Market

- **Primary**: API-first companies (fintech, dev infra, AI platforms) shipping integration kits to enterprise customers.
- **Secondary**: Internal platform teams replacing fragmented Postman/Bruno usage with a versioned source of truth.
- **Adjacent**: AI agents that need an executable, machine-readable description of how to call a third-party API.

The API management market is projected to exceed $13B by 2027. Existing tooling solves *design* (OpenAPI) and *exploration* (Postman). Runbook solves the gap in between: **executable, versioned, distributable workflows**.

## How it works

### Core primitives

- **API Block** — A reusable HTTP request template. Inputs (user-supplied fields), request shape (method, URL, headers, body — all with `{{token}}` interpolation), outputs (JSONPath extractors that feed the run context).
- **Scenario** — An ordered list of blocks with per-step overrides. Reusable scenarios embed inside other scenarios as `scenario-ref` blocks.
- **Graph** — Visual node/edge editor for branching flows. Same scenario, two views.
- **Environment** — Base URL + auth (bearer, cookie, API key, basic). Switch staging ↔ production with one click.
- **Project Bundle** — A single `.json` file containing every version of a project. Importers automatically activate the latest semver; switching versions is instant.

### Architecture

```
apps/
  web/        Browser-first React app (Mantine, Vite). All state in localStorage.
  server/     Optional Fastify + Socket.io backend (multi-user, persistent runs).
packages/
  shared/     Zod schemas — single source of truth across web & server.
```

Designed to run **fully client-side** for solo use, and to scale to a team backend without changing the bundle format.

## Quick start

```bash
pnpm install
pnpm dev          # web app on http://localhost:3005
pnpm dev:server   # optional backend on http://localhost:4000
```

No database, no signup. Import a bundle, run a scenario, ship.

### Common commands

```bash
pnpm build        # production build (all packages)
pnpm test         # vitest across the workspace
pnpm lint         # ESLint with design-system rules enforced
```

## Design system

Every color, radius, shadow, and spacing token lives in [`apps/web/src/theme.ts`](apps/web/src/theme.ts). Components specify a prop only when it differs from the theme default — and ESLint blocks hex literals, off-palette color names, and inline magic numbers.

See [`CLAUDE.md`](CLAUDE.md) for the full rule set and the live design reference at `/demo.html`.

## Roadmap

- [x] Browser-first runtime with localStorage persistence
- [x] Versioned project bundles with semver-aware version switcher
- [x] Graph mode with branching flows
- [x] Shared Zod schemas, Fastify backend, Socket.io live runs
- [ ] Bundle signing & registry (`runbook publish` / `runbook install`)
- [ ] OpenAPI → blocks importer
- [ ] Hosted team workspaces with role-based access
- [ ] MCP integration: expose any bundle as a tool surface for AI agents
- [ ] SOC 2, SSO, audit logs (enterprise tier)

## Documentation

- [Bundle format reference](docs/bundle-format.md) — complete JSON schema
- **Schema tab** in the running app — interactive field reference with examples
- [`CLAUDE.md`](CLAUDE.md) — engineering conventions and design-system rules

## Team & contact

Building Runbook out of 32CO.

- **Investment / partnership** — [hxtruong6@gmail.com](mailto:hxtruong6@gmail.com)
- **Design partners** — [open an issue](https://github.com/hxtruong6/runbook/issues/new) tagged `design-partner`
- **Deep dive** — [PITCH.md](PITCH.md) covers the problem, market, GTM, and ask

---

<div align="center">
<sub>Runbook — version your APIs the way you version your code.</sub>
</div>
