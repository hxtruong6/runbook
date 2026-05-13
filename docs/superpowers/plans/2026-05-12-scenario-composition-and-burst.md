# Scenario Composition + Burst Mode

**Date:** 2026-05-12
**Status:** Proposed
**Scope:** Two related features for the chairside API runner.

---

## Motivation

Today every scenario is a flat list of API blocks. Real test flows share setup: "create user → login" is a prefix to *test logout*, *test update profile*, *test feature highlights*, etc. Copy-pasting those prefix steps into every scenario is the same pain we just removed for API definitions (bundles).

Separately, the user wants to fire a scenario many times in a short window (e.g. 10×/1s, 20×/0.5s) to catch race conditions, rate limits, and idempotency bugs that single-shot runs miss. This is **burst smoke testing**, explicitly *not* full load testing — we accept the browser's fetch-concurrency ceiling.

Both features compose: a stress run of "logout" implicitly stresses the shared "create user → login" setup block.

---

## Feature 1 — Scenarios as reusable blocks

### Model

Introduce a new block kind: `scenario-ref`.

```ts
// extension of BlockInstance
{
  id: "abc",
  kind: "scenario-ref",
  overrides: {
    scenarioId: "scn-create-and-login",
    continueOnError: false,        // default false; abort parent on sub-failure
    contextOverrides: { ... }      // optional: pre-seed ctx keys before sub-run
  }
}
```

At execution time, `runScenarioFrom` expands the ref **inline**:
- Sub-scenario's blocks run with the *same* `RuntimeContext` reference (mutated through `...result.captured` spread, as today).
- Outputs captured by the sub-scenario (e.g. `jwt`, `userId`) are visible to subsequent parent blocks — that's the whole point.
- A sub-scenario block result is recorded as a single composite `BlockRunResult` in the parent's result list (`status: "ok" | "err"`, with a nested `subResults: BlockRunResult[]` for the UI to expand).

### Cycle detection

Maintain a `Set<scenarioId>` of currently-expanding scenarios passed down the recursion. If a ref points to an id already in the set → fail with `error: "Cycle detected: A → B → A"`. Cheap, O(depth).

### Persistence

`scenario-ref` is just another `BlockInstance` — no schema changes needed in `ScenarioSchema`. Storage and export/import already round-trip arbitrary `kind` values.

### Registry

`scenario-ref` is **not** in `COMPILED_BLOCKS` or in any bundle's `blocks[]`. It's a runtime-virtual block that the executor handles directly (similar to how `socketConnect` is special-cased today). The block-picker UI lists it under a dedicated "Composition" group.

### UI

- **Insert flow:** "Add block" menu gets a "Reuse scenario…" entry → opens a small modal with a Select of available scenarios in the current project + a `continueOnError` switch.
- **Render in scenario:** `BlockCard` for `scenario-ref` shows the referenced scenario name, child count, and an accordion to reveal sub-results after a run.
- **Edit:** clicking the title opens the same Select modal. No inline editing of the sub-scenario from here — user navigates to the sub-scenario to edit it.

### Out of scope (explicit)

- **Parameterizing a sub-scenario** beyond `contextOverrides`. If you need different inputs per use site, just clone the scenario. Don't reinvent function arguments.
- **Loops / conditionals.** Scenarios stay linear.
- **Exporting a scenario as a "macro block"** in a bundle. Bundles already serialize full scenarios; cross-bundle reuse isn't requested.

### Tasks

1. **types & schema** — Add `ScenarioRefOverridesSchema` (zod) under `src/blocks/`. Extend `BlockRunResult` with optional `subResults: BlockRunResult[]`.
2. **executor** — Refactor `runScenarioFrom` so the loop body is a helper `runOneBlock(inst, ctx, expandingIds)`. `scenario-ref` branch: look up scenario by id from `ScenariosStore`, cycle-check, recurse, aggregate sub-results, capture outputs into ctx. (TDD: 6+ tests — straight expansion, ctx propagation, cycle, missing scenario id, sub-error abort, sub-error continueOnError.)
3. **block-picker integration** — New "Composition" group in the add-block menu; `ScenarioRefPickerModal` component.
4. **rendering** — `BlockCard` branch for `scenario-ref`: title = sub-scenario name + badge "ref"; expandable sub-result list using `Accordion`.
5. **edge cases** — Deleting a scenario that's referenced elsewhere: don't cascade; on next run the executor reports `Unknown scenario id`. Add a soft warning in the scenarios sidebar (small `Badge` "referenced by N").

---

## Feature 2 — Burst mode

### Model

A "burst" is a *runtime invocation parameter*, not a stored entity. User picks a scenario, opens "Run burst…", configures:

```ts
{
  count: 10,                       // total invocations
  windowMs: 1000,                  // spread across this window
  concurrency: "parallel" | "sequential",
  staggerMs?: number,              // optional, derived from count/windowMs if "parallel"
  freshContext: boolean            // true = each run starts from makeInitialContext(); false = shared ctx
}
```

`freshContext: true` is the default and the only safe option for parallel — sharing a context across parallel runs would race on `ctx.jwt`. `freshContext: false` is only enabled when `concurrency === "sequential"`.

### Execution

New function `runBurst(scenario, opts, env, registry)`:
- Builds N copies of `initialCtx`.
- `sequential`: for-loop over `runScenarioFrom`, collect run-level summary.
- `parallel`: schedules with `setTimeout` offsets `i * staggerMs`; each starts `runScenarioFrom` and a `Promise.all` aggregates.
- Per run, capture: start ts, end ts, total ms, final status (ok if all blocks ok), failing-block index if any.

### Aggregation

After all runs complete, compute:
- count ok / err
- elapsedMs: min, p50, p95, max
- error breakdown (group by `error` string, count occurrences)
- timeline: list of `{ runIdx, startedAt, elapsedMs, status }`

### UI — Drawer (not Modal)

A right-side `<Drawer position="right" size="lg">` triggered by the existing (currently disabled) "Burst…" item in the TopBar `⋮` menu. A Drawer over a Modal because the scenario's blocks must remain visible on the left — burst is *about* a specific scenario.

The drawer is a three-stage state machine on the same surface:

1. **Config stage** (initial)
   - `NumberInput count` and `NumberInput windowMs` side-by-side, with inline hints "max 200" / "min 50ms".
   - `SegmentedControl` parallel | sequential.
   - `Switch` "Fresh context per run" — auto-on AND disabled when parallel is selected, with a small dimmed explanation underneath.
   - Footer: `<Button>Start burst</Button>` (filled, indigo).

2. **Running stage** (entered when start clicked)
   - Replaces the form (NOT a new dialog).
   - `<Progress value={done/count}>` bar at top.
   - Tally chips: "{ok} ok · {err} err · {pending} left" using small Mantine `Badge`s with the same color scheme as `BlockCard` status.
   - **Timeline strip**: `count` thin colored ticks in a flex row. Each tick = one run. State colors: gray (pending) → yellow (running) → teal (ok) / red (err). Live-updates as runs progress. Each tick is `12px wide, 24px tall`, gap 2px; if count > 80, ticks shrink to fit.
   - Footer: `<Button variant="default">Cancel</Button>` — calls an `AbortController` if implemented, otherwise just hides results.

3. **Results stage** (entered when all runs done)
   - Summary card (Mantine `Paper withBorder p="md"`): count total, error rate %, latency p50 / p95 / max ms, total elapsed.
   - Timeline strip stays, now fully colored. Clicking a tick selects that run and reveals a drill-down panel below.
   - Error breakdown: collapsible section listing each unique error string with its count, sorted by count desc.
   - Drill-down panel (visible when a tick is selected): one row per block in that run, showing status Badge + block label + elapsedMs; clickable to expand the full `ResponseViewer`.
   - Footer: `<Button variant="default">Export JSON</Button>`, `<Button variant="default">Run again</Button>` (resets to config stage with same values), `<Button variant="subtle">Close</Button>`.

### Trigger affordance

Replace the disabled "Burst…" Tooltip-wrapped Menu.Item in `TopBar.tsx` with an enabled item. Add a small zap icon (inline SVG, no new deps) as `leftSection`. Disabled when no `active` scenario.

### Cancel semantics

`runBurst` accepts an `AbortSignal`. When aborted: stop scheduling new runs, but let in-flight runs complete (their results are still recorded). Drawer transitions to Results stage with whatever was collected.

### Safety rails

- Hard cap: `count <= 200`, `windowMs >= 50`. Above that, show a warning and refuse — this is a *smoke* tool.
- "Run burst" disabled if the scenario contains a `socketConnect` block (those are skipped anyway, but bursting a socket setup is nonsensical).
- A scenario that uses `scenario-ref` is fine — sub-scenarios are expanded per run independently.

### Out of scope

- Ramp-up / ramp-down profiles.
- Distributed runners.
- Persisting burst results into the project bundle.
- Real-time charts (a static timeline strip is enough).

### Tasks

1. **types** — `BurstOptionsSchema`, `BurstRunResult`, `BurstSummary` in `src/execution/burst.ts`.
2. **runBurst** — Implementation + TDD (sequential happy path, parallel happy path, count cap, parallel forces freshContext, error aggregation).
3. **stats helpers** — `percentiles(arr, [50, 95])` pure function with tests.
4. **BurstModal component** — Config form + live progress + results view; uses Mantine `Progress`, `Table`, `SegmentedControl`.
5. **TopBar integration** — "Burst…" button, disabled when no scenario active.
6. **Export** — `exportBurstResults(summary): Blob` (JSON), reuse existing download helper from `environments/exportImport.ts`.

---

## Interaction between the two features

When a `scenario-ref` block is inside a scenario being burst-run:
- Each parent invocation independently expands the ref → sub-scenario also runs N times in total.
- Cycle detection state is per-invocation (lives in the recursion, not global), so parallel bursts don't false-positive each other.
- Sub-result aggregation in the burst summary stays at the parent-block grain to keep the stats panel readable; "drill into run #7" shows the nested sub-results.

---

## Rollout order

Build **Feature 1 first**, ship, use it for a week, then build Feature 2. Reason:
- Composition has higher daily value (kills copy-paste right away).
- Burst is dependent on the executor refactor in Feature 1 task 2 (the `runOneBlock` helper makes burst's per-run isolation cleaner). Doing them in this order means Feature 2 doesn't need rework.

---

## UI / UX redesign (applies to F1; F2 modal stays separate)

Decisions made — not negotiable mid-build, captured here so subagents have one source of truth.

### Sidebar (left navbar)

- Scenarios split into two collapsible groups via Mantine `<Accordion variant="filled">`:
  - **Flows** — scenarios meant to be run end-to-end (default for new scenarios).
  - **Reusable** — scenarios whose primary purpose is to be referenced from others (login, create-user, etc.).
- A scenario's group is determined by a new boolean `Scenario.reusable` (default `false`, optional in zod so existing scenarios deserialize fine).
- A scenario card in the Reusable group shows a small `Badge size="xs" variant="light" color="indigo">ref</Badge>` and, when applicable, "used by N" subtle text.
- Bottom of the Scenarios section: `Button variant="subtle" size="xs" leftSection={+}` "New scenario". Disabled when a project is active (read-only mode unchanged).

### Block list (main area)

- Today `BlockCard`s are static — no add affordance. Add a persistent `<Button variant="default" size="sm"` leftSection={+} fullWidth/>` "Add block" at the **end** of the block list.
- Clicking opens a Mantine `<Menu>` with two grouped sections:
  - **API blocks** — every kind in the merged registry (compiled + data), grouped by source ("Built-in" / project name). Each item shows the block label.
  - **Composition** — single entry "Reuse scenario…" → opens `ScenarioRefPickerModal`.
- Per-block `<ActionIcon variant="subtle">⋮</ActionIcon>` Menu added to `BlockCard` header with: Run from here, Duplicate, Remove, Insert below…. (Run from here button stays in the header too — the menu only deduplicates if it crowds; for now keep both.)

### Scenario-ref BlockCard

- Visual: `Paper withBorder` but with `style={{ borderStyle: "dashed" }}` and a `Badge color="grape" variant="light">scenario</Badge>` in the header.
- Header content: sub-scenario name (clickable → navigate to that scenario), child-count text like "3 steps".
- Body when idle: short summary listing the first 3 step names + "…and N more" if longer.
- Body after run: Mantine `<Accordion variant="separated">` with one item per sub-block result; each item header shows status Badge + block label; expanded content reuses `ResponseViewer`.
- A small `<Switch size="xs" label="continue on error"/>` lives in the card body (only place this setting lives — no separate config modal).

### TopBar reshuffle

Current: env switcher | scenario title + project badge | [Run all] [Import] [Export]
New:

- **Left:** env switcher (unchanged).
- **Center:** scenario title + project badge + (if scenario is reusable) the `ref` badge.
- **Right:** primary `<Button>` "Run all" (filled, indigo) + secondary `<Menu>` `<ActionIcon variant="subtle">⋮</ActionIcon>` containing "Burst…" (F2, disabled stub for now), "Import scenario", "Export scenario", "Duplicate scenario", "Toggle reusable".

This frees horizontal space for the scenario title and prevents button-creep when F2 lands.

### `ScenarioRefPickerModal`

- Mantine `<Modal title="Reuse scenario">` containing:
  - `<TextInput>` filter.
  - List of available scenarios (current local set OR active project version) as `<Paper>` rows showing name + step count + reusable badge. Click row to select.
  - `<Switch label="Continue on error if sub-scenario fails" />` (sets the ref's `continueOnError`).
  - Footer: "Cancel" / "Insert".
- Reusable scenarios appear at the top of the list and are pre-sorted; non-reusable scenarios appear below under a `<Divider label="Other scenarios" />`.

### Paper-style consistency

All new surfaces use the established defaults (`withBorder`, `radius="md"`, `shadow="xs"`). No new colors introduced beyond `grape` (for scenario-ref accents) and the existing indigo primary.

### Out of scope (UI)

- Drag-to-reorder blocks (existing flat reorder UX is untouched).
- Sub-scenario tree visualization (depth shown via accordion nesting only).
- Theme dark mode (still light-only).

---

## Open questions for the user

1. **Sub-scenario UI depth limit?** No technical limit beyond cycle check, but should the UI cap nesting depth (e.g. refuse to render >3 levels of accordions)? I'd say no — the accordion handles it.
2. **Burst output redaction.** If a burst run captures `password` into ctx (unlikely but possible), should the exported JSON redact it? Easiest: reuse the existing context redaction rule (`password` key → `•••`) when serializing.
3. **Burst error grouping key.** Group by `error` string verbatim, or normalize (strip timestamps/ids)? Verbatim for now; normalize only if it becomes noisy in practice.
