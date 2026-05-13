# Runbook

A versioned, runnable API integration kit. Build flows from reusable API blocks, ship them to your team as a single JSON bundle, and stay in sync as APIs change. Build flows from reusable API blocks, run them step-by-step or as a graph, and distribute pre-built scenarios through versioned JSON bundles.

---

## What it does

| Feature | Description |
|---|---|
| **API Blocks** | Data-driven HTTP request definitions with `{{template}}` variable substitution |
| **Scenarios / Flows** | Ordered sequences of blocks with per-block input overrides |
| **Graph mode** | Visual flow editor — drag nodes, connect with ok/error edges |
| **Environments** | Switch base URL and auth config without editing scenarios |
| **Project bundles** | Import a JSON file that ships blocks + scenarios + environments + changelog |
| **Version switcher** | Compare behaviour across v1.0, v1.1, v2.0 within the same bundle |
| **Local block editor** | Create and manage your own API blocks on top of what a bundle provides |

---

## Quick start

```bash
pnpm install
pnpm dev        # starts on http://localhost:3005
```

The app runs entirely in the browser. All local data (scenarios, blocks, environments) is persisted in `localStorage`. No backend, no database.

---

## Concepts

### API Block

A reusable HTTP request template. Defines inputs (fields the user fills in), the request shape (method, URL, headers, body — all supporting `{{token}}` interpolation), and outputs (JSON paths extracted from the response and saved to the run context so later blocks can reference them).

See [docs/bundle-format.md](docs/bundle-format.md#api-block-blockdefdata) for the full field reference.

### Scenario

An ordered list of block usages. Each block in a scenario can override default input values. Scenarios can be marked **reusable**, which means they can be embedded inside other flows as a `scenario-ref` block.

Scenarios can be viewed and edited in two modes:
- **List mode** — linear card view, good for simple flows
- **Graph mode** — node/edge canvas, good for branching logic

### Environment

Holds `baseUrl` and auth config (bearer token, cookie, API key, basic auth). Switch environments to point the same scenario at staging vs. production without changing anything else.

### Project Bundle

A single `.json` file that a team distributes. Contains all versions of the project, each version carrying its own full snapshot of blocks, scenarios, environments, and release notes. Import it via the **Project** section in the sidebar.

The app automatically selects the **latest version** (by semver) as the default. Use the version dropdown to switch to any previous release.

---

## Creating scenarios locally

1. Make sure no project is active (or work outside a project)
2. Click **New scenario** in the sidebar
3. Add blocks via **Add block** in the main area
4. Fill in input overrides per block
5. Click **Run all** or **Run from here** on any block

To mark a scenario as reusable: right-click (⋯) it in the sidebar → **Make reusable**.

---

## Creating local API blocks

1. Switch to the **API Blocks** tab in the main area
2. Click **New API block**
3. Fill in kind, label, auth mode, inputs, request, and outputs
4. Save — the block is now available when adding to any scenario

Local blocks are stored in `localStorage` and supplement (or override by `kind`) what a project bundle provides.

---

## Importing a project bundle

1. In the sidebar under **Project**, click **Import**
2. Select a `.json` bundle file
3. The project is loaded and the latest version is activated
4. All scenarios, blocks, and environments from that version are now available (read-only)

To switch version: use the version dropdown under the project name.

---

## Development

```bash
pnpm dev          # dev server on :3005
pnpm build        # production build
pnpm test         # vitest run
pnpm lint         # ESLint (design-system rules enforced)
pnpm lint:fix     # auto-fix
```

### Key directories

```
src/
  blocks/         API block definitions, registry, local block store
  scenarios/      Scenario types, storage, prebuilt examples
  projects/       Bundle types, storage, semver utilities
  environments/   Environment types and storage
  graph/          Graph data types and runtime runner
  execution/      Scenario runner logic
  context/        Runtime context store (values passed between blocks)
  components/     All UI components
  theme.ts        Mantine theme — single source of truth for all design tokens
```

### Design system rules

All colors, spacing, and radii come from `src/theme.ts`. Do not hardcode values in components. ESLint will fail on hex literals, forbidden color names, or inline `borderRadius`/`padding`/`margin` numbers. See `CLAUDE.md` for the full rule set.

---

## Further reading

- [Bundle format reference](docs/bundle-format.md) — complete JSON schema for project bundles and API blocks
- **Schema tab** in the running app — interactive field reference with examples
