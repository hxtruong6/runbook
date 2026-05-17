# Runbook — Growth Roadmap

**Goal:** acquire first wave of real (free) users. Every item below is scoped so it can be picked up by an independent agent in parallel. Each item lists: *why it moves the needle*, *main steps*, *files/areas touched*, *acceptance criteria*, and *parallel-safety notes* (what it must NOT touch so two agents can work concurrently).

Legend:
- **P0** = ship this week, blocks viral loop
- **P1** = ship in 2–3 weeks, compounding distribution
- **P2** = ship next, retention / depth

---

# Part 1 — 10 highest-impact features

## F1. Paste-curl-to-block  (P0)

**Why:** lowest-friction entry point. Any dev reading API docs can convert a `curl` snippet into a runnable block in one paste. Shareable demo on Twitter.

**Main steps:**
1. Add a `parseCurl(input: string)` utility in `packages/shared/src/curl/` — handle `-X`, `-H`, `-d`, `--data-raw`, `-u`, `--url`, line continuations, single+double quotes.
2. Map parsed result onto the existing `ApiBlock` Zod schema (method, url, headers, body, auth hints).
3. UI: add a "Paste curl" button on the Blocks list page and inside the empty-state. Opens a modal with a textarea + live preview of the resulting block.
4. On confirm, insert the block into the active project; navigate to the block editor.
5. Unit tests covering 10+ real-world curl snippets (Stripe, GitHub, OpenAI, internal common patterns).

**Files / areas:** `packages/shared/src/curl/*` (new), `apps/web/src/features/blocks/PasteCurlModal.tsx` (new), `apps/web/src/features/blocks/BlockList.tsx` (button only).

**Acceptance:** pasting `curl https://api.stripe.com/v1/customers -u sk_test_xxx:` produces a working block runnable against staging env in <5 s.

**Parallel-safety:** owns `curl/` folder and `PasteCurlModal.tsx`. Must NOT change `ApiBlock` schema shape — read-only consumer.

---

## F2. OpenAPI / Swagger importer  (P0)

**Why:** every API-first company already has a spec. One import = a fully populated bundle = instant value. Biggest single distribution wedge.

**Main steps:**
1. Add `openapi-types` + `@apidevtools/swagger-parser` deps in `packages/shared`.
2. Build `importOpenApi(specUrlOrJson): Bundle` in `packages/shared/src/import/openapi.ts`. One block per operation. Inputs from `parameters`+`requestBody`. Outputs left empty by default. Group operations by `tags` into scenarios.
3. UI flow: Import menu → "From OpenAPI" → URL input or file drop → preview list of operations (checkboxes to select) → confirm → bundle created.
4. Handle auth schemes (bearer, apiKey header/query, basic) by emitting one Environment per scheme with placeholder secrets.
5. Tests against Stripe, GitHub, Petstore specs.

**Files / areas:** `packages/shared/src/import/openapi.ts` (new), `apps/web/src/features/import/OpenApiImport.tsx` (new), import menu entry in `apps/web/src/App.tsx`.

**Acceptance:** dropping Petstore OpenAPI yields a bundle with all operations as blocks, grouped scenarios, and a runnable environment.

**Parallel-safety:** owns `import/openapi.ts` and the OpenApiImport screen. Read-only on `Bundle` schema.

---

## F3. Shareable run links  (P0)

**Why:** every shared link is a free acquisition channel. Recipients sign up to fork.

**Main steps:**
1. Server: `POST /api/share` accepts `{ bundle, scenarioId, runResult }`, redacts env secrets, returns `{ slug }`. Store in a `shares` table keyed by short slug (8 chars, base62).
2. Server: `GET /s/:slug` returns JSON; web route `/s/:slug` renders read-only run view.
3. Web: "Share run" button on the run-result panel → calls API → copies link → toast.
4. Redaction rules: strip all `Authorization`, cookie headers, query params matching `*key*|*token*|*secret*` (regex configurable in env), replace with `***`.
5. Add a "Fork into my workspace" CTA on the read-only view → imports bundle into local storage.
6. Migration for `shares` table (id, slug, payload JSONB, created_at, expires_at).

**Files / areas:** `apps/server/src/routes/share.ts` (new), `apps/server/migrations/<ts>_shares.sql` (new), `apps/web/src/features/runs/ShareRunButton.tsx` (new), `apps/web/src/pages/SharedRun.tsx` (new).

**Acceptance:** click "Share run" → paste link in incognito → see redacted run result + "Fork" CTA.

**Parallel-safety:** owns the `share*` routes and `shares` migration. Coordinate with F8 if CLI also needs share API.

---

## F4. "Run in Runbook" embeddable button  (P1)

**Why:** API providers paste a badge once in their README/docs and we ride their traffic forever. Postman's growth flywheel.

**Main steps:**
1. Design a small SVG badge (white + dark variants).
2. Generator UI: pick a bundle/scenario → outputs Markdown `[![Run in Runbook](badge.svg)](runbook.app/run?bundle=<url>)` and HTML snippets. Copy buttons.
3. Web route `/run?bundle=<url>&scenario=<id>` fetches bundle from URL, opens it in a fresh in-browser session with the scenario preselected.
4. Add CORS allow-list logic and a friendly error if the bundle URL blocks cross-origin fetches.
5. Track referrer in a lightweight analytics event when the route is hit.

**Files / areas:** `docs/assets/badge*.svg` (new), `apps/web/src/pages/RunFromUrl.tsx` (new), `apps/web/src/features/share/EmbedBadgeModal.tsx` (new).

**Acceptance:** generated Markdown renders a badge in a GitHub README; clicking it opens the scenario ready to run.

**Parallel-safety:** new pages/files only. Read-only on bundle schema.

---

## F5. Browser extension: capture from network tab  (P1)

**Why:** turns every dev's existing workflow into Runbook content with zero re-typing.

**Main steps:**
1. New package: `apps/extension/` (MV3, Chrome+Firefox). Uses `chrome.devtools.network` API.
2. Devtools panel listing captured requests; checkbox + "Send to Runbook".
3. Two transport modes: (a) deep-link `runbook.app/import-har?payload=<…>` for users without the app open; (b) `postMessage` to a same-origin local instance.
4. HAR → blocks converter (reuse parsing from F1 where possible; HAR is structurally cleaner than curl).
5. Publish to Chrome Web Store (manual; document the steps in `apps/extension/README.md`).

**Files / areas:** `apps/extension/*` (new), `packages/shared/src/import/har.ts` (new).

**Acceptance:** record a request in any web app's DevTools, click "Send to Runbook", land in the block editor with the request prefilled.

**Parallel-safety:** entirely new `apps/extension` package. Shares `import/har.ts` location — coordinate with F2 author on the `import/` folder structure.

---

## F6. GitHub integration / bundle-as-repo  (P1)

**Why:** devs trust git. Bundles in a repo = free hosting, free versioning, readable PR diffs, GitHub stars as social proof.

**Main steps:**
1. Define a repo layout convention: `runbook.json` at repo root OR `bundles/*.json`.
2. CLI command `runbook init` scaffolds a repo with a sample bundle + GitHub Action that validates the bundle on PR.
3. Web: "Import from GitHub" — paste a repo URL → fetch raw bundle file → open in workspace.
4. Pretty PR diff: a GitHub Action that, on PRs touching `runbook.json`, posts a comment with a human-readable diff (block added/removed, scenario changed, env changes) using the same diff renderer as UX-D8.
5. Optional: GitHub App for richer status checks (defer to P2).

**Files / areas:** `apps/cli/src/commands/init.ts` (new — see F8), `.github/templates/validate-bundle.yml` (new), `apps/web/src/features/import/GithubImport.tsx` (new).

**Acceptance:** `runbook init my-bundle` produces a repo that, on PR, comments a readable diff of bundle changes.

**Parallel-safety:** depends on F8 (CLI) for `runbook init`. Can be built in parallel if the CLI exposes a minimal stub.

---

## F7. MCP server export  (P1)

**Why:** AI-agent crowd is the hottest 2026 distribution channel. Every bundle becomes a Claude/Cursor/ChatGPT tool surface for free.

**Main steps:**
1. New package `apps/mcp-server/` using `@modelcontextprotocol/sdk`.
2. Command: `runbook mcp <bundle.json>` starts a stdio MCP server exposing each scenario as a tool. Tool name = scenario id; input schema = scenario inputs; output = run result JSON.
3. Map runtime errors to MCP error responses; stream progress for long-running scenarios.
4. Document Claude Desktop and Cursor config snippets in `docs/mcp.md`.
5. Publish to npm as `@runbook/mcp`.

**Files / areas:** `apps/mcp-server/*` (new), `docs/mcp.md` (new).

**Acceptance:** add `@runbook/mcp` to Claude Desktop config pointing at a bundle → Claude can call scenarios as tools.

**Parallel-safety:** entirely new package. Read-only consumer of bundle runtime — extract the runner into `packages/shared` if not already there (coordinate with F8).

---

## F8. CLI runner  (P0/P1 — foundation for F6, F7)

**Why:** unlocks CI usage (smoke tests, contract tests, scheduled probes). Every CI run = a recurring active user.

**Main steps:**
1. New package `apps/cli/` with `commander` or `cac`. Commands: `run <bundle> <scenarioId>`, `validate <bundle>`, `init <name>`, `mcp <bundle>` (delegates to F7).
2. Extract the scenario runner from `apps/web` into `packages/shared/src/runtime/` so both web and CLI use the same code.
3. Env injection: `--env <name>` + `--var key=value` flags + `.env` autoload.
4. Exit codes: 0 on success, 1 on block failure, 2 on validation error.
5. Pretty TTY output (chalk/picocolors) + `--json` machine output.
6. Publish to npm as `@runbook/cli`.

**Files / areas:** `apps/cli/*` (new), `packages/shared/src/runtime/*` (refactored out of web).

**Acceptance:** `npx @runbook/cli run my-bundle.json checkout-flow --env staging` runs the scenario and exits cleanly in CI.

**Parallel-safety:** refactor of the runner into `packages/shared/src/runtime/` is the only place this conflicts with web changes. Do this refactor first and merge before other agents pick up F1/F2/F3.

---

## F9. AI block generation from natural language  (P2)

**Why:** lowers the floor for non-experts. "Create a block that searches Stripe customers by email" → working block.

**Main steps:**
1. Server route `POST /api/ai/generate-block` taking `{ prompt, context }` (context = current bundle's blocks + envs for grounding).
2. System prompt instructs the model to emit a JSON `ApiBlock` matching the Zod schema; validate output and retry up to 2x on schema failures.
3. UI: "Generate with AI" button next to "New block" → prompt input → preview → accept.
4. Provider abstraction: support Anthropic by default; allow user-supplied API key in settings.
5. Rate-limit per IP for unauthenticated users.

**Files / areas:** `apps/server/src/routes/ai.ts` (new), `apps/web/src/features/blocks/GenerateWithAi.tsx` (new), `apps/web/src/settings/AiProviderSettings.tsx` (new).

**Acceptance:** prompt "list github repos for user X" produces a runnable block calling `GET /users/{username}/repos`.

**Parallel-safety:** new server route + new web feature. Coordinate only on settings page placement.

---

## F10. Public bundle gallery  (P1)

**Why:** SEO, social proof, fastest onboarding ("see Stripe in one click"). Each gallery page is an indexed landing page.

**Main steps:**
1. Curate 8–12 reference bundles (Stripe, GitHub, OpenAI, Anthropic, Slack, Linear, Notion, Vercel). Store as static JSON in `apps/web/public/gallery/`.
2. Gallery index page `/gallery` — searchable grid (name, description, version, scenario count, last updated). SSG-friendly so it indexes.
3. Detail page `/gallery/<slug>` — block list, scenario list, "Open in Runbook" CTA (uses F4's `/run?bundle=` route).
4. SEO: og-image per bundle, sitemap entry, `<title>` and meta description from bundle metadata.
5. Submission form (Google Form is fine for v1) for community-submitted bundles.

**Files / areas:** `apps/web/public/gallery/*.json` (new), `apps/web/src/pages/Gallery.tsx` (new), `apps/web/src/pages/GalleryDetail.tsx` (new), `apps/web/public/sitemap.xml` updates.

**Acceptance:** google "stripe runbook bundle" → gallery page appears → click → scenario opens ready to run.

**Parallel-safety:** standalone pages and static assets. No schema changes.

---

# Part 2 — 10 UI/UX redesigns

## UX-D1. Zero-friction landing  (P0)

**Why:** time-to-first-run should be under 10 seconds. Empty-state-first UX kills conversion.

**Main steps:**
1. On first visit (no localStorage projects), auto-load a pre-built "Tour" bundle pinned in `public/`.
2. Replace the current empty state with a guided 3-step tooltip walkthrough: pick env → run scenario → view result.
3. Add a top-bar dismissible banner: "Trying Runbook — your data stays in this browser. Save & sync? [later]"
4. Telemetry event `first_run_completed` (anonymous, opt-out).

**Files / areas:** `apps/web/src/App.tsx`, `apps/web/public/tour-bundle.json` (new), `apps/web/src/features/onboarding/Tour.tsx` (new).

**Acceptance:** clean browser → open app → click one button → see a green run result. No reading required.

**Parallel-safety:** owns onboarding feature folder. Coordinate with UX-D7 (empty states share the sample-bundle source).

---

## UX-D2. Command palette (⌘K)  (P1)

**Why:** power users feel at home immediately; reduces clicks for repeat tasks (re-run last scenario).

**Main steps:**
1. Install `cmdk` (or `mantine-spotlight` — already in the Mantine stack).
2. Actions: jump to block/scenario/env, run last scenario, paste curl (calls F1), import OpenAPI (calls F2), share run (F3), toggle color scheme, open demo.
3. Global keybinding ⌘K / Ctrl+K, focusable from anywhere, ESC closes.
4. Fuzzy search over block names, scenario names, env names. Recent items pinned to top.

**Files / areas:** `apps/web/src/features/palette/CommandPalette.tsx` (new), `apps/web/src/App.tsx` (mount).

**Acceptance:** ⌘K + type "stripe" + Enter runs the Stripe scenario.

**Parallel-safety:** isolated new feature; only `App.tsx` is touched (one mount line).

---

## UX-D3. Inline request/response diff viewer  (P1)

**Why:** make iteration feel like a REPL. Today users squint at JSON; diff between runs shows progress.

**Main steps:**
1. Keep the last N (default 5) run results per scenario in memory.
2. Add a "Compare with previous" toggle on the run result panel — side-by-side or unified JSON diff (use `jsondiffpatch` or `diff`).
3. Highlight added/removed/changed keys with the design-system colors (green/red/amber).
4. Persist last run per scenario to localStorage so the diff survives refresh.

**Files / areas:** `apps/web/src/features/runs/RunResultPanel.tsx` (modify), `apps/web/src/features/runs/RunDiff.tsx` (new), `apps/web/src/state/runHistory.ts` (new).

**Acceptance:** run scenario twice with different inputs → diff shows changed response fields highlighted.

**Parallel-safety:** owns RunDiff component and runHistory state slice. Touches RunResultPanel — coordinate with UX-D4 if both modify the same file.

---

## UX-D4. Split-pane editor with quick graph toggle  (P1)

**Why:** Postman muscle memory. Don't force users to leave the familiar mental model.

**Main steps:**
1. Block editor: left = inputs/request form, right = last response. Resizable split (use Mantine's `Resizable` or `react-resizable-panels`).
2. Scenario editor: list mode (current) ↔ graph mode toggle via a button in the header AND a keystroke (e.g. `G`).
3. Persist user's preferred mode per scenario in localStorage.
4. Ensure both modes round-trip without data loss.

**Files / areas:** `apps/web/src/features/blocks/BlockEditor.tsx` (modify), `apps/web/src/features/scenarios/ScenarioEditor.tsx` (modify).

**Acceptance:** toggle graph ↔ list 10 times — no data loss; pane sizes restored on refresh.

**Parallel-safety:** modifies block/scenario editor files heavily. Pin one agent to this and avoid concurrent edits to these files.

---

## UX-D5. Visible, trustworthy secrets handling  (P0 for trust)

**Why:** secrets are the #1 reason a dev won't try a new HTTP tool. Make safety obvious.

**Main steps:**
1. Per-env "Secret" indicator: lock icon + count of secret fields. Click → list of fields marked secret with visibility toggles.
2. Mark fields as secret via a checkbox or convention (`*_key`, `*_token`, `password`, `secret*`).
3. Redaction in: run history UI (`••••`), shareable links (F3), exported bundles (warn + redact on export option).
4. Storage: never plaintext in shared links; localStorage encryption out of scope for v1 but add a `// TODO` and warn user on first secret entry.

**Files / areas:** `apps/web/src/features/env/EnvEditor.tsx`, `apps/web/src/features/env/SecretBadge.tsx` (new), `packages/shared/src/redact.ts` (new — shared with F3).

**Acceptance:** mark a field secret → it's redacted in run history and in shared run links.

**Parallel-safety:** shared `redact.ts` is the only coupling — coordinate with F3 author.

---

## UX-D6. Postman collection importer  (P0)

**Why:** the single biggest barrier today is "I already have 200 requests in Postman." Meet users where they are.

**Main steps:**
1. `packages/shared/src/import/postman.ts` — Postman Collection v2.1 → bundle. One block per request; folders → scenarios; env exports supported.
2. UI: Import menu → "From Postman" → file drop (`.json`) → preview → confirm.
3. Map Postman variables (`{{var}}`) directly (already same syntax — bonus).
4. Tests against 5 real public Postman collections.

**Files / areas:** `packages/shared/src/import/postman.ts` (new), `apps/web/src/features/import/PostmanImport.tsx` (new).

**Acceptance:** drop a real exported Postman collection → all requests appear as blocks, folders as scenarios, env vars preserved.

**Parallel-safety:** new files; coordinate `import/` folder structure with F2 and F5.

---

## UX-D7. Empty states with one-click sample bundles  (P1)

**Why:** empty states sell the product. Reuse F10's gallery as the sample source.

**Main steps:**
1. Replace each blank list (no blocks / no scenarios / no envs) with a "Try a sample" card listing 3–4 sample bundles.
2. One click loads the sample into a new project (doesn't overwrite the user's data).
3. Use the design system's empty-state pattern (icon + title + helper + CTA) per `CLAUDE.md`.

**Files / areas:** `apps/web/src/components/EmptyState.tsx` (modify or new), block/scenario/env list pages.

**Acceptance:** brand new workspace → every empty list shows samples + a working one-click load.

**Parallel-safety:** depends on F10 gallery JSON existing (or stub locally).

---

## UX-D8. Version-diff as a first-class screen  (P1)

**Why:** the differentiator vs Postman. Bundles' `changes[]` is the source of truth — render it as a hero feature, not a dropdown.

**Main steps:**
1. New page `/versions` per project: left = version list, right = diff between selected version and the next/previous.
2. Render `changes[]` from the bundle directly (per the user's memory: this is authoritative — do NOT compute a diff client-side).
3. Group by type: blocks added/changed/removed; scenarios; envs; release notes.
4. Add a "Copy upgrade checklist" button → markdown of the change list for paste into a team chat.
5. Link from the version switcher dropdown.

**Files / areas:** `apps/web/src/pages/VersionsPage.tsx` (new), `apps/web/src/features/versions/ChangeList.tsx` (new).

**Acceptance:** open a bundle with 3 versions → diff between v1.0 and v1.1 displays the authoritative release notes in a readable diff.

**Parallel-safety:** new page + new feature folder. No schema changes.

---

## UX-D9. Mobile-readable run results  (P1)

**Why:** most shared links open on phones. A broken mobile view kills the F3 viral loop.

**Main steps:**
1. Audit `/s/:slug` (from F3) and the main run result panel on a 360px viewport.
2. Collapse side panels into accordions on small screens.
3. JSON viewer: line-wrap, monospace 13px, sticky key column scroll.
4. Ensure CTAs (Fork, Share) are ≥44px tap targets per `CLAUDE.md`.

**Files / areas:** `apps/web/src/pages/SharedRun.tsx`, `apps/web/src/features/runs/RunResultPanel.tsx` (responsive CSS only).

**Acceptance:** open a shared run on an iPhone — readable, scrollable, CTAs tappable, no horizontal scroll.

**Parallel-safety:** CSS / responsive layout only; coordinate timing with F3.

---

## UX-D10. Polished marketing site  (P1)

**Why:** the homepage right now is a README. Visitors need clarity in <5 seconds.

**Main steps:**
1. New marketing route `/` (move app to `/app`) OR a separate static site in `apps/marketing/` (Astro or plain Vite).
2. Above-the-fold: one-line value prop, ~15s looping product video (record with Loom/Screen Studio), big "Try in browser — no signup" CTA → `/app`.
3. Sections: problem, how it works (3-step illustration), bundle gallery (links to F10), "Run in Runbook" badge generator preview (F4), pricing-free note, GitHub link.
4. Lighthouse score ≥95 on all categories.
5. og:image, Twitter card meta, sitemap.

**Files / areas:** `apps/marketing/*` (new) OR new `apps/web/src/pages/Landing.tsx` + routing updates.

**Acceptance:** non-technical visitor reads the homepage and can articulate what Runbook does in one sentence.

**Parallel-safety:** if built as `apps/marketing/`, fully isolated. If embedded in web app, coordinate routing changes with UX-D1.

---

# Parallel-execution plan

Suggested wave structure if you spin up multiple agents:

**Wave 1 (foundation — do first, must merge before Wave 2):**
- F8 CLI / runtime extraction (creates `packages/shared/src/runtime/`)
- UX-D5 redaction helper (creates `packages/shared/src/redact.ts`)

**Wave 2 (parallel, no overlap):**
- F1 paste-curl (owns `shared/curl/`, new modal)
- F2 OpenAPI importer (owns `shared/import/openapi.ts`)
- F3 share links (owns server `share` routes + new page)
- F10 gallery (owns `public/gallery/`, new pages)
- UX-D1 landing tour (owns onboarding feature)
- UX-D2 command palette (isolated)
- UX-D8 versions page (isolated)
- UX-D10 marketing site (isolated if `apps/marketing/`)

**Wave 3 (depends on Wave 2 outputs):**
- F4 embed badge (uses F2/F10 bundles)
- F6 GitHub integration (uses F8 CLI)
- F7 MCP server (uses F8 runtime)
- UX-D3 run diff (touches RunResultPanel — solo edit)
- UX-D4 split-pane (touches editors — solo edit)
- UX-D6 Postman import (folder convention from F2)
- UX-D7 empty states (uses F10 gallery)
- UX-D9 mobile (touches F3 shared run page)

**Wave 4:**
- F5 browser extension
- F9 AI block generation

Agents in the same wave should each be told explicitly which files they own and which files are off-limits — the "Parallel-safety" line per item lists this.
