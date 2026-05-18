# Design: User Flow Documentation & Playwright Journey Tests

**Date:** 2026-05-18  
**Status:** Approved

---

## 1. Goal

Produce two deliverables:

1. **Living documentation** — one markdown file per user journey under `docs/flows/`, describing the happy path, edge cases, key state, and related flows.
2. **Playwright journey tests** — one spec file per journey under `apps/web/e2e/journeys/`, covering the happy path and key edge cases using journey-based (end-to-end scenario) grouping.

---

## 2. Journey Map (30 Journeys)

| # | Journey | Flow doc | Spec file |
|---|---------|----------|-----------|
| 01 | New User Onboarding | `docs/flows/01-new-user-onboarding.md` | `onboarding.spec.ts` |
| 02 | API Testing via cURL Paste | `docs/flows/02-api-testing-curl.md` | `api-testing.spec.ts` |
| 03 | OpenAPI Import | `docs/flows/03-openapi-import.md` | `openapi-import.spec.ts` |
| 04 | Block Library Management | `docs/flows/04-block-library.md` | `block-library.spec.ts` |
| 05 | Environment & Auth Configuration | `docs/flows/05-environments.md` | `environments.spec.ts` |
| 06 | Schema Inference | `docs/flows/06-schema-inference.md` | `inference.spec.ts` |
| 07 | Project Management | `docs/flows/07-project-management.md` | `project-mgmt.spec.ts` |
| 08 | Burst Runner | `docs/flows/08-burst-runner.md` | `burst-runner.spec.ts` |
| 09 | Graph Mode | `docs/flows/09-graph-mode.md` | `graph-mode.spec.ts` |
| 10 | Gallery & Run-from-URL | `docs/flows/10-gallery-run-from-url.md` | `gallery.spec.ts` |
| 11 | Password Reset | `docs/flows/11-password-reset.md` | `password-reset.spec.ts` |
| 12 | Guest Access & Sign-in Prompt | `docs/flows/12-guest-access.md` | `guest-access.spec.ts` |
| 13 | Scenario Lifecycle Management | `docs/flows/13-scenario-lifecycle.md` | `scenario-lifecycle.spec.ts` |
| 14 | Nested Scenarios (Scenario Ref) | `docs/flows/14-nested-scenarios.md` | `nested-scenarios.spec.ts` |
| 15 | Block Assertions & Validation | `docs/flows/15-block-assertions.md` | `block-assertions.spec.ts` |
| 16 | Context & Data Flow | `docs/flows/16-context-data-flow.md` | `context-data-flow.spec.ts` |
| 17 | Save Block to Library | `docs/flows/17-save-block-to-library.md` | `save-block-to-library.spec.ts` |
| 18 | Postman Collection Import | `docs/flows/18-postman-import.md` | `postman-import.spec.ts` |
| 19 | GitHub Repository Import | `docs/flows/19-github-import.md` | `github-import.spec.ts` |
| 20 | Bundle Publish & Embed Badge | `docs/flows/20-bundle-publish-embed.md` | `bundle-publish.spec.ts` |
| 21 | Shared Run View | `docs/flows/21-shared-run-view.md` | `shared-run.spec.ts` |
| 22 | Project Version History | `docs/flows/22-version-history.md` | `version-history.spec.ts` |
| 23 | Run History & Diff | `docs/flows/23-run-history-diff.md` | `run-history.spec.ts` |
| 24 | Command Palette | `docs/flows/24-command-palette.md` | `command-palette.spec.ts` |
| 25 | What's New & Release Notes | `docs/flows/25-whats-new.md` | `whats-new.spec.ts` |
| 26 | Data Block & URL Template | `docs/flows/26-data-block-url-template.md` | `data-block.spec.ts` |
| 27 | Socket Connect Block | `docs/flows/27-socket-connect-block.md` | `socket-connect.spec.ts` |
| 28 | Error & Recovery States | `docs/flows/28-error-recovery-states.md` | `error-recovery.spec.ts` |
| 29 | Block Editor Modal | `docs/flows/29-block-editor-modal.md` | `block-editor-modal.spec.ts` |
| 30 | CLI Guide & Keyboard Shortcuts | `docs/flows/30-cli-guide-keyboard-shortcuts.md` | `cli-shortcuts.spec.ts` |

---

## 3. Test Architecture

### 3.1 Approach: Journey-Based Specs

Each spec file represents one realistic end-to-end user journey. Tests within a spec are `test.step()`-annotated to document each action. A journey test is allowed to span multiple pages and use multiple real UI interactions — no unit-test style isolation within journeys.

### 3.2 Auth Strategy: Hybrid

- **Real auth:** A shared `fixtures/auth.ts` helper signs up or logs in a real user against the running backend server. The token is stored in `localStorage` via `page.evaluate()` before each test.
- **Mocked data endpoints:** All project, scenario, block, and environment API calls are intercepted using `page.route()` and responded to with fixture JSON files from `apps/web/e2e/fixtures/`.

This strategy keeps tests deterministic and fast while validating real auth flows.

```
apps/web/e2e/
├── journeys/                  ← 30 spec files (one per journey)
│   ├── onboarding.spec.ts
│   ├── api-testing.spec.ts
│   └── ... (28 more)
├── fixtures/
│   ├── auth.ts                ← signup/login helpers (real backend)
│   ├── mocks.ts               ← page.route() interceptor helpers
│   ├── bundles/
│   │   ├── sample-project.json
│   │   └── cworld-openapi.json
│   └── responses/
│       ├── users-1.json
│       └── posts.json
└── _artifacts/                ← screenshots from test runs
```

### 3.3 Fixture File Conventions

**`fixtures/auth.ts`**
```typescript
export async function signUpAndLogin(page: Page): Promise<string> {
  // POST /api/auth/register with random email
  // Returns JWT token; sets localStorage['runbook:auth']
}

export async function loginAsExisting(page: Page, email: string, password: string): Promise<void> {
  // POST /api/auth/login
}
```

**`fixtures/mocks.ts`**
```typescript
export async function mockProjectsApi(page: Page, projects: ProjectBundle[]): Promise<void> {
  await page.route('**/api/projects**', route => route.fulfill({ json: projects }));
}

export async function mockScenariosApi(page: Page, scenarios: Scenario[]): Promise<void> {
  await page.route('**/api/scenarios**', route => route.fulfill({ json: scenarios }));
}
// ... similar helpers for blocks, environments, runs
```

### 3.4 Spec File Structure

Each spec follows this pattern:

```typescript
import { test, expect } from '@playwright/test';
import { signUpAndLogin } from '../fixtures/auth';
import { mockProjectsApi, mockScenariosApi } from '../fixtures/mocks';
import sampleProject from '../fixtures/bundles/sample-project.json';

test.describe('Journey 02 — API Testing via cURL Paste', () => {

  test.beforeEach(async ({ page }) => {
    await signUpAndLogin(page);
    await mockProjectsApi(page, [sampleProject]);
    await page.goto('/');
  });

  test('happy path: paste cURL, run block, see 200 response', async ({ page }) => {
    await test.step('open add-block menu', async () => { ... });
    await test.step('paste cURL command', async () => { ... });
    await test.step('verify block appears', async () => { ... });
    await test.step('run the block', async () => { ... });
    await test.step('verify 200 response', async () => { ... });
  });

  test('edge case: invalid cURL shows error', async ({ page }) => { ... });
  test('edge case: network failure shows red status', async ({ page }) => { ... });

});
```

### 3.5 Coverage Per Spec

Each spec covers:
- **1 happy path test** — full golden path as described in the flow doc
- **2–4 edge case tests** — the key error conditions from the flow doc

Total: ~30 spec files × ~3 tests = ~90 tests.

---

## 4. Playwright Configuration

Update `apps/web/playwright.config.ts`:

```typescript
{
  testDir: './e2e',
  testMatch: ['journeys/**/*.spec.ts'],   // only journey specs by default
  // existing e2e specs remain at top-level e2e/
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  reporter: [['html', { outputFolder: 'e2e/_reports' }]],
  use: {
    baseURL: 'http://localhost:3000',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
}
```

Run journeys only:
```bash
pnpm playwright test --project=chromium e2e/journeys/
```

---

## 5. Documentation Conventions

### Flow Doc Structure
Each `docs/flows/NN-slug.md` file contains:
- **Summary** — one paragraph
- **Actors** — who performs the flow
- **Preconditions** — what must be true before starting
- **Steps** — numbered happy path; sub-sections for named variants
- **Edge Cases** — bulleted list with expected UI response
- **Key State** — localStorage keys and values after the flow (where applicable)
- **Related Flows** — links to other flow docs

### Naming Conventions
- Flow docs: `NN-kebab-slug.md` (zero-padded two-digit number)
- Spec files: `kebab-slug.spec.ts` (no number prefix)
- Fixtures: named after the resource they mock (`sample-project.json`, `users-1.json`)

---

## 6. Implementation Plan

The implementation will proceed in these phases:

### Phase 1 — Shared Infrastructure (fixtures/ + playwright config)
- `fixtures/auth.ts` — signup/login helpers
- `fixtures/mocks.ts` — route interceptors
- `fixtures/bundles/sample-project.json` — minimal project fixture
- `fixtures/responses/*.json` — HTTP response fixtures
- Update `playwright.config.ts`

### Phase 2 — Core Journey Specs (flows 01–10)
The foundational journeys that most other tests depend on.

### Phase 3 — Scenario & Block Journeys (flows 11–17)
Scenario lifecycle, nested scenarios, assertions, context flow, block library.

### Phase 4 — Import Journeys (flows 18–19)
Postman and GitHub import.

### Phase 5 — Share & History Journeys (flows 20–23)
Bundle publish, shared run, version history, run history.

### Phase 6 — UI & Utility Journeys (flows 24–30)
Command palette, what's new, data blocks, socket, error recovery, block editor, CLI guide.

---

## 7. Out of Scope

- Unit tests for individual components (covered by existing Vitest suite)
- Performance/load testing (covered by burst runner manually)
- Backend API contract tests
- Mobile/responsive testing (desktop Chromium only for v1)
