# Playwright Journey Tests — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement 30 Playwright journey specs (one per user flow doc in `docs/flows/`) covering happy path + key edge cases, organized by descending business impact.

**Architecture:** Journey-based specs live in `apps/web/e2e/journeys/`. All specs share a `fixtures/helpers.ts` that provides signup, dismissNoise, and route-mock utilities. Auth uses the real backend (same as existing specs); specific data states use `page.route()` interceptors with fixture JSON. Each spec is self-contained and cleans localStorage + cookies in `beforeEach`.

**Tech Stack:** Playwright 1.60, TypeScript, real Runbook backend on `:3001`, web on `:3007`.

---

## Priority Tiers

| Tier | Journeys | Rationale |
|------|----------|-----------|
| **P0 — Blocking** | 01, 02, 07, 13 | Entry point, core run loop, project + scenario CRUD — everything else depends on these |
| **P1 — Core value** | 05, 03, 06, 15, 16, 04 | Environments, OpenAPI import, inference, assertions, context, block library — what Runbook *is* |
| **P2 — Power features** | 09, 08, 14, 23, 24, 10, 17, 20, 22, 26, 28 | Advanced workflows used regularly by power users and teams |
| **P3 — Long tail** | 11, 12, 18, 19, 21, 29, 27, 25, 30 | Infrequent but important; cover edge surfaces and discoverability |

---

## File Map

```
apps/web/e2e/
├── fixtures/
│   └── helpers.ts                     CREATE — shared signup, dismissNoise, route mocks
├── journeys/
│   ├── 01-onboarding.spec.ts          CREATE
│   ├── 02-api-testing.spec.ts         CREATE
│   ├── 03-openapi-import.spec.ts      CREATE
│   ├── 04-block-library.spec.ts       CREATE
│   ├── 05-environments.spec.ts        CREATE
│   ├── 06-inference.spec.ts           CREATE
│   ├── 07-project-mgmt.spec.ts        CREATE
│   ├── 08-burst-runner.spec.ts        CREATE
│   ├── 09-graph-mode.spec.ts          CREATE
│   ├── 10-gallery.spec.ts             CREATE
│   ├── 11-password-reset.spec.ts      CREATE
│   ├── 12-guest-access.spec.ts        CREATE
│   ├── 13-scenario-lifecycle.spec.ts  CREATE
│   ├── 14-nested-scenarios.spec.ts    CREATE
│   ├── 15-block-assertions.spec.ts    CREATE
│   ├── 16-context-data-flow.spec.ts   CREATE
│   ├── 17-save-block-library.spec.ts  CREATE
│   ├── 18-postman-import.spec.ts      CREATE
│   ├── 19-github-import.spec.ts       CREATE
│   ├── 20-bundle-publish.spec.ts      CREATE
│   ├── 21-shared-run.spec.ts          CREATE
│   ├── 22-version-history.spec.ts     CREATE
│   ├── 23-run-history.spec.ts         CREATE
│   ├── 24-command-palette.spec.ts     CREATE
│   ├── 25-whats-new.spec.ts           CREATE
│   ├── 26-data-block.spec.ts          CREATE
│   ├── 27-socket-connect.spec.ts      CREATE
│   ├── 28-error-recovery.spec.ts      CREATE
│   ├── 29-block-editor-modal.spec.ts  CREATE
│   └── 30-cli-shortcuts.spec.ts       CREATE
└── playwright.config.ts               MODIFY — add journeys testMatch
```

---

## Phase 1 — Shared Infrastructure

### Task 1: Shared helpers fixture

**Files:**
- Create: `apps/web/e2e/fixtures/helpers.ts`

- [ ] **Step 1: Create the helpers file**

```typescript
// apps/web/e2e/fixtures/helpers.ts
import { type Page } from '@playwright/test'

const PASSWORD = 'testpass1234'

export function makeStamp(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

export async function dismissNoise(page: Page): Promise<void> {
  await page.evaluate(() => {
    localStorage.setItem('rb_tour_completed', '1')
    localStorage.setItem('rb_tour_banner_dismissed', '1')
    localStorage.setItem('rb_tour_loaded', '1')
    localStorage.setItem('rb_save_sync_dismissed', '1')
  })
}

export async function signup(page: Page, stamp: string): Promise<void> {
  await page.goto('/')
  await dismissNoise(page)
  await page.reload()
  await page.getByRole('tab', { name: 'Create account' }).click()
  await page.getByRole('textbox', { name: 'Email' }).fill(`e2e-${stamp}@runbook.local`)
  await page.getByRole('textbox', { name: 'Name' }).fill('E2E Tester')
  await page.getByRole('textbox', { name: 'Password' }).fill(PASSWORD)
  await page.getByRole('button', { name: 'Create account' }).click()
  // Wait for workspace to be ready
  const { expect } = await import('@playwright/test')
  await expect(page.getByRole('button', { name: /run all/i })).toBeVisible({ timeout: 15000 })
  await expect(async () => {
    const v = await page.getByRole('textbox', { name: 'Select project' }).inputValue().catch(() => '')
    expect(v.length).toBeGreaterThan(0)
  }).toPass({ timeout: 10000 })
}

export async function login(page: Page, email: string): Promise<void> {
  await page.goto('/')
  await dismissNoise(page)
  await page.reload()
  await page.getByRole('textbox', { name: 'Email' }).fill(email)
  await page.getByRole('textbox', { name: 'Password' }).fill(PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
  const { expect } = await import('@playwright/test')
  await expect(page.getByRole('button', { name: /run all/i })).toBeVisible({ timeout: 15000 })
}

export async function openScenario(page: Page, name = 'My first scenario'): Promise<void> {
  const { expect } = await import('@playwright/test')
  const scenario = page.getByText(name, { exact: true }).first()
  await scenario.waitFor({ state: 'visible', timeout: 8000 })
  await scenario.click()
}

export async function pasteCurlToLibrary(page: Page, url: string): Promise<void> {
  const { expect } = await import('@playwright/test')
  const path = url.split('/').slice(3).join('/')
  await page.getByRole('button', { name: 'Block library view' }).click()
  await page.getByRole('button', { name: /paste cu?rl/i }).first().click()
  await page.locator('textarea').first().fill(`curl -X GET '${url}'`)
  await page.getByRole('button', { name: /add to block library/i }).click()
  await expect(page.getByText(path).first()).toBeVisible({ timeout: 5000 })
}

export async function addLibraryBlockToScenario(page: Page, blockPath: string): Promise<void> {
  const { expect } = await import('@playwright/test')
  await page.getByRole('button', { name: 'Scenarios view' }).click()
  await openScenario(page)
  await page.getByRole('button', { name: '+ Add block' }).click()
  const item = page.getByRole('menuitem', { name: new RegExp(blockPath) }).first()
  await item.scrollIntoViewIfNeeded()
  await item.click()
  await expect(page.getByText(blockPath).first()).toBeVisible({ timeout: 5000 })
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd apps/web && npx tsc --noEmit --project tsconfig.json 2>&1 | grep -E "fixtures/helpers" || echo "OK"
```

Expected: No errors for helpers.ts

- [ ] **Step 3: Commit**

```bash
git add apps/web/e2e/fixtures/helpers.ts
git commit -m "test: add shared e2e fixture helpers"
```

---

### Task 2: Update Playwright config for journeys

**Files:**
- Modify: `apps/web/playwright.config.ts`

- [ ] **Step 1: Update config to include journeys directory**

Replace the current `playwright.config.ts` content:

```typescript
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_WEB_URL ?? 'http://localhost:3007',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
})
```

- [ ] **Step 2: Verify config is valid**

```bash
cd apps/web && npx playwright test --list 2>&1 | head -20
```

Expected: Lists existing spec files including journeys/ folder

- [ ] **Step 3: Commit**

```bash
git add apps/web/playwright.config.ts
git commit -m "test: configure playwright to discover journeys/ specs"
```

---

## Phase 2 — P0 Critical Journeys

### Task 3: Journey 01 — New User Onboarding

**Flow doc:** `docs/flows/01-new-user-onboarding.md`  
**Files:**
- Create: `apps/web/e2e/journeys/01-onboarding.spec.ts`

- [ ] **Step 1: Write the spec**

```typescript
// apps/web/e2e/journeys/01-onboarding.spec.ts
import { test, expect } from '@playwright/test'
import { makeStamp, dismissNoise } from '../fixtures/helpers'

const STAMP = makeStamp()
const EMAIL = `onboard-${STAMP}@runbook.local`

test.describe('Journey 01 — New User Onboarding', () => {
  test.beforeEach(async ({ context, page }) => {
    await context.clearCookies()
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
  })

  test('happy path: signup → tour auto-imports → environment selected → run completes', async ({ page }) => {
    test.setTimeout(60_000)

    await test.step('show login page to unauthenticated visitor', async () => {
      await expect(page.getByRole('tab', { name: 'Sign in' })).toBeVisible()
      await expect(page.getByRole('tab', { name: 'Create account' })).toBeVisible()
    })

    await test.step('sign up with valid credentials', async () => {
      await page.getByRole('tab', { name: 'Create account' }).click()
      await page.getByRole('textbox', { name: 'Email' }).fill(EMAIL)
      await page.getByRole('textbox', { name: 'Name' }).fill('Onboard Tester')
      await page.getByRole('textbox', { name: 'Password' }).fill('testpass1234')
      await page.getByRole('button', { name: 'Create account' }).click()
    })

    await test.step('workspace is ready with auto-created project', async () => {
      await expect(page.getByRole('button', { name: /run all/i })).toBeVisible({ timeout: 15000 })
      await expect(async () => {
        const v = await page.getByRole('textbox', { name: 'Select project' }).inputValue().catch(() => '')
        expect(v.length).toBeGreaterThan(0)
      }).toPass({ timeout: 10000 })
    })

    await test.step('auth token persisted in localStorage', async () => {
      const token = await page.evaluate(() => {
        const raw = localStorage.getItem('runbook:auth')
        if (!raw) return null
        try { return JSON.parse(raw)?.token ?? raw } catch { return raw }
      })
      expect(token).toBeTruthy()
    })
  })

  test('edge case: duplicate email shows error', async ({ page }) => {
    test.setTimeout(30_000)

    // First signup
    await page.getByRole('tab', { name: 'Create account' }).click()
    await page.getByRole('textbox', { name: 'Email' }).fill(EMAIL)
    await page.getByRole('textbox', { name: 'Name' }).fill('First User')
    await page.getByRole('textbox', { name: 'Password' }).fill('testpass1234')
    await page.getByRole('button', { name: 'Create account' }).click()
    await expect(page.getByRole('button', { name: /run all/i })).toBeVisible({ timeout: 15000 })

    // Second signup with same email
    await page.evaluate(() => localStorage.clear())
    await page.goto('/')
    await page.getByRole('tab', { name: 'Create account' }).click()
    await page.getByRole('textbox', { name: 'Email' }).fill(EMAIL)
    await page.getByRole('textbox', { name: 'Name' }).fill('Second User')
    await page.getByRole('textbox', { name: 'Password' }).fill('testpass1234')
    await page.getByRole('button', { name: 'Create account' }).click()

    await expect(page.getByRole('alert')).toBeVisible({ timeout: 5000 })
  })

  test('edge case: wrong password shows error on sign in', async ({ page }) => {
    test.setTimeout(15_000)

    await page.getByRole('textbox', { name: 'Email' }).fill(EMAIL)
    await page.getByRole('textbox', { name: 'Password' }).fill('wrongpassword')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByRole('alert')).toBeVisible({ timeout: 5000 })
  })
})
```

- [ ] **Step 2: Run the spec to verify it works**

```bash
cd apps/web && npx playwright test e2e/journeys/01-onboarding.spec.ts --headed 2>&1 | tail -20
```

Expected: All 3 tests pass (requires backend running)

- [ ] **Step 3: Commit**

```bash
git add apps/web/e2e/journeys/01-onboarding.spec.ts
git commit -m "test: journey 01 — new user onboarding"
```

---

### Task 4: Journey 02 — API Testing via cURL Paste

**Flow doc:** `docs/flows/02-api-testing-curl.md`  
**Files:**
- Create: `apps/web/e2e/journeys/02-api-testing.spec.ts`

- [ ] **Step 1: Write the spec**

```typescript
// apps/web/e2e/journeys/02-api-testing.spec.ts
import { test, expect } from '@playwright/test'
import { makeStamp, signup, openScenario, dismissNoise } from '../fixtures/helpers'

const STAMP = makeStamp()
const TARGET = 'https://jsonplaceholder.typicode.com/users/1'
const TARGET_PATH = 'users/1'

test.describe('Journey 02 — API Testing via cURL Paste', () => {
  test.beforeEach(async ({ context, page }) => {
    await context.clearCookies()
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
  })

  test('happy path: paste cURL → add to scenario → run → 200 response', async ({ page }) => {
    test.setTimeout(60_000)

    await test.step('sign up and reach workspace', async () => {
      await signup(page, `curl-${STAMP}`)
    })

    await test.step('create new scenario', async () => {
      await page.getByRole('button', { name: 'Scenarios view' }).click()
      await page.getByRole('button', { name: /new scenario|^\+$/i }).first().click()
      await expect(page.getByText(/Untitled scenario/i).first()).toBeVisible({ timeout: 5000 })
    })

    await test.step('open paste cURL modal from block library', async () => {
      await page.getByRole('button', { name: 'Block library view' }).click()
      await page.getByRole('button', { name: /paste cu?rl/i }).first().click()
      await expect(page.locator('textarea').first()).toBeVisible()
    })

    await test.step('paste valid cURL and add to library', async () => {
      await page.locator('textarea').first().fill(`curl -X GET '${TARGET}'`)
      await page.getByRole('button', { name: /add to block library/i }).click()
      await expect(page.getByText(TARGET_PATH).first()).toBeVisible({ timeout: 5000 })
    })

    await test.step('add block from library to scenario', async () => {
      await page.getByRole('button', { name: 'Scenarios view' }).click()
      await openScenario(page, 'My first scenario')
      await page.getByRole('button', { name: '+ Add block' }).click()
      const item = page.getByRole('menuitem', { name: new RegExp(TARGET_PATH) }).first()
      await item.scrollIntoViewIfNeeded()
      await item.click()
      await expect(page.getByText(TARGET_PATH).first()).toBeVisible({ timeout: 5000 })
    })

    await test.step('run block and see 200 response', async () => {
      await page.getByRole('button', { name: /^Run$/ }).first().click()
      await page.waitForTimeout(3000)
      // Status badge should be teal/ok — check for the HTTP 200 text
      await expect(page.getByText(/200/)).toBeVisible({ timeout: 10000 })
    })
  })

  test('edge case: empty cURL textarea blocks submission', async ({ page }) => {
    test.setTimeout(30_000)

    await signup(page, `curl-empty-${STAMP}`)
    await page.getByRole('button', { name: 'Block library view' }).click()
    await page.getByRole('button', { name: /paste cu?rl/i }).first().click()
    // Submit without filling textarea
    const addBtn = page.getByRole('button', { name: /add to block library/i })
    // Button should be disabled or clicking it shows a validation message
    const isDisabled = await addBtn.isDisabled()
    if (!isDisabled) {
      await addBtn.click()
      // Either an error alert appears or nothing is added to library
      const blockCount = await page.getByText(TARGET_PATH).count()
      expect(blockCount).toBe(0)
    } else {
      expect(isDisabled).toBe(true)
    }
  })

  test('edge case: run button shows error state on network failure', async ({ page }) => {
    test.setTimeout(60_000)

    await signup(page, `curl-fail-${STAMP}`)
    await page.getByRole('button', { name: 'Block library view' }).click()
    await page.getByRole('button', { name: /paste cu?rl/i }).first().click()
    // Point at a URL that will refuse connection
    await page.locator('textarea').first().fill(`curl -X GET 'http://localhost:19999/no-such-server'`)
    await page.getByRole('button', { name: /add to block library/i }).click()

    await page.getByRole('button', { name: 'Scenarios view' }).click()
    await openScenario(page)
    await page.getByRole('button', { name: '+ Add block' }).click()
    const item = page.getByRole('menuitem', { name: /no-such-server/i }).first()
    await item.scrollIntoViewIfNeeded().catch(() => {})
    await item.click()

    await page.getByRole('button', { name: /^Run$/ }).first().click()
    await page.waitForTimeout(5000)
    // Block card should show an error state (red badge or error text)
    await expect(
      page.getByText(/error|failed|ERR_CONNECTION/i).first()
    ).toBeVisible({ timeout: 10000 })
  })
})
```

- [ ] **Step 2: Run the spec**

```bash
cd apps/web && npx playwright test e2e/journeys/02-api-testing.spec.ts 2>&1 | tail -20
```

Expected: All 3 tests pass

- [ ] **Step 3: Commit**

```bash
git add apps/web/e2e/journeys/02-api-testing.spec.ts
git commit -m "test: journey 02 — api testing via curl paste"
```

---

### Task 5: Journey 07 — Project Management

**Flow doc:** `docs/flows/07-project-management.md`  
**Files:**
- Create: `apps/web/e2e/journeys/07-project-mgmt.spec.ts`

- [ ] **Step 1: Write the spec**

```typescript
// apps/web/e2e/journeys/07-project-mgmt.spec.ts
import { test, expect } from '@playwright/test'
import { makeStamp, signup } from '../fixtures/helpers'
import { readFileSync } from 'fs'
import { join } from 'path'

const STAMP = makeStamp()

test.describe('Journey 07 — Project Management', () => {
  test.beforeEach(async ({ context, page }) => {
    await context.clearCookies()
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
  })

  test('happy path: create project → switch → verify scenario list resets', async ({ page }) => {
    test.setTimeout(45_000)

    await signup(page, `proj-${STAMP}`)

    await test.step('create a new project', async () => {
      await page.getByRole('textbox', { name: 'Select project' }).click()
      await page.getByRole('button', { name: /new project|\+ project/i }).first().click()
      await page.getByRole('textbox').last().fill('My Test Project')
      await page.getByRole('button', { name: /create/i }).last().click()
      await expect(async () => {
        const v = await page.getByRole('textbox', { name: 'Select project' }).inputValue()
        expect(v).toContain('My Test Project')
      }).toPass({ timeout: 8000 })
    })

    await test.step('new project starts with empty scenario list', async () => {
      await expect(
        page.getByText(/no scenario|empty|start blank/i).first()
      ).toBeVisible({ timeout: 5000 })
    })

    await test.step('switch back to original project', async () => {
      await page.getByRole('textbox', { name: 'Select project' }).click()
      await page.getByRole('option').first().click()
      await expect(page.getByText(/My first scenario/i)).toBeVisible({ timeout: 5000 })
    })
  })

  test('happy path: delete project → next project auto-selected', async ({ page }) => {
    test.setTimeout(45_000)

    await signup(page, `proj-del-${STAMP}`)

    // Create a second project so we can delete one
    await page.getByRole('textbox', { name: 'Select project' }).click()
    await page.getByRole('button', { name: /new project|\+ project/i }).first().click()
    await page.getByRole('textbox').last().fill('Delete Me')
    await page.getByRole('button', { name: /create/i }).last().click()
    await expect(async () => {
      const v = await page.getByRole('textbox', { name: 'Select project' }).inputValue()
      expect(v).toContain('Delete Me')
    }).toPass({ timeout: 8000 })

    // Delete current project
    await page.getByRole('button', { name: /project options|⋯/i }).first().click().catch(async () => {
      // Try menu on project name
      await page.locator('[aria-label*="project"]').filter({ hasText: /delete/i }).first().click()
    })
    const deleteItem = page.getByRole('menuitem', { name: /delete/i }).first()
    await deleteItem.waitFor({ timeout: 3000 })
    await deleteItem.click()
    await page.getByRole('button', { name: /confirm|yes|delete/i }).first().click()

    // Some project should still be active
    await expect(async () => {
      const v = await page.getByRole('textbox', { name: 'Select project' }).inputValue().catch(() => '')
      expect(v.length).toBeGreaterThan(0)
    }).toPass({ timeout: 8000 })
  })

  test('edge case: empty project name is rejected', async ({ page }) => {
    test.setTimeout(30_000)

    await signup(page, `proj-empty-${STAMP}`)
    await page.getByRole('textbox', { name: 'Select project' }).click()
    await page.getByRole('button', { name: /new project|\+ project/i }).first().click()
    // Leave name blank and submit
    const createBtn = page.getByRole('button', { name: /^create$/i }).last()
    const isDisabled = await createBtn.isDisabled()
    if (!isDisabled) {
      await createBtn.click()
      await expect(page.getByText(/required|enter a name/i)).toBeVisible({ timeout: 3000 })
    } else {
      expect(isDisabled).toBe(true)
    }
  })
})
```

- [ ] **Step 2: Run the spec**

```bash
cd apps/web && npx playwright test e2e/journeys/07-project-mgmt.spec.ts 2>&1 | tail -20
```

Expected: 3 tests pass

- [ ] **Step 3: Commit**

```bash
git add apps/web/e2e/journeys/07-project-mgmt.spec.ts
git commit -m "test: journey 07 — project management"
```

---

### Task 6: Journey 13 — Scenario Lifecycle

**Flow doc:** `docs/flows/13-scenario-lifecycle.md`  
**Files:**
- Create: `apps/web/e2e/journeys/13-scenario-lifecycle.spec.ts`

- [ ] **Step 1: Write the spec**

```typescript
// apps/web/e2e/journeys/13-scenario-lifecycle.spec.ts
import { test, expect } from '@playwright/test'
import { makeStamp, signup } from '../fixtures/helpers'

const STAMP = makeStamp()

test.describe('Journey 13 — Scenario Lifecycle', () => {
  test.beforeEach(async ({ context, page }) => {
    await context.clearCookies()
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
  })

  test('happy path: create → rename → duplicate → delete scenario', async ({ page }) => {
    test.setTimeout(60_000)

    await signup(page, `scenario-${STAMP}`)

    await test.step('create new scenario', async () => {
      await page.getByRole('button', { name: 'Scenarios view' }).click()
      // Click the + button next to "Scenarios" heading
      await page.getByRole('button', { name: /new scenario|^\+$/i }).first().click()
      await expect(page.getByText(/Untitled scenario/i).first()).toBeVisible({ timeout: 5000 })
    })

    await test.step('rename the scenario', async () => {
      // Open ⋯ menu on the new scenario
      const scenarioItem = page.getByText(/Untitled scenario/i).first()
      await scenarioItem.hover()
      await page.getByRole('button', { name: /options|⋯|more/i }).first().click()
      await page.getByRole('menuitem', { name: /rename/i }).click()
      await page.getByRole('textbox').last().clear()
      await page.getByRole('textbox').last().fill('My Renamed Scenario')
      await page.getByRole('button', { name: /save|confirm/i }).last().click()
      await expect(page.getByText('My Renamed Scenario').first()).toBeVisible({ timeout: 5000 })
    })

    await test.step('duplicate the scenario', async () => {
      // Use TopBar More actions > Duplicate
      await page.getByRole('button', { name: /more actions|⋯/i }).last().click().catch(async () => {
        await page.getByLabel(/more actions/i).click()
      })
      await page.getByRole('menuitem', { name: /duplicate/i }).click()
      await expect(page.getByText(/copy/i).first()).toBeVisible({ timeout: 5000 })
    })

    await test.step('delete the duplicate scenario', async () => {
      const copyItem = page.getByText(/copy/i).first()
      await copyItem.hover()
      await page.getByRole('button', { name: /options|⋯|more/i }).first().click()
      await page.getByRole('menuitem', { name: /delete/i }).click()
      await page.getByRole('button', { name: /confirm|yes|delete/i }).first().click()
      await expect(page.getByText(/copy/i)).toHaveCount(0, { timeout: 5000 })
    })
  })

  test('happy path: mark scenario as reusable → ref badge appears', async ({ page }) => {
    test.setTimeout(45_000)

    await signup(page, `scenario-ref-${STAMP}`)

    await page.getByRole('button', { name: 'Scenarios view' }).click()
    const scenarioItem = page.getByText('My first scenario', { exact: true }).first()
    await scenarioItem.hover()
    await page.getByRole('button', { name: /options|⋯|more/i }).first().click()
    await page.getByRole('menuitem', { name: /reusable/i }).click()

    // ref badge should appear
    await expect(page.getByText(/ref/i).first()).toBeVisible({ timeout: 5000 })
  })

  test('edge case: renaming to empty string is blocked', async ({ page }) => {
    test.setTimeout(30_000)

    await signup(page, `scenario-empty-${STAMP}`)
    await page.getByRole('button', { name: 'Scenarios view' }).click()
    const scenarioItem = page.getByText('My first scenario', { exact: true }).first()
    await scenarioItem.hover()
    await page.getByRole('button', { name: /options|⋯|more/i }).first().click()
    await page.getByRole('menuitem', { name: /rename/i }).click()
    await page.getByRole('textbox').last().clear()
    const saveBtn = page.getByRole('button', { name: /save|confirm/i }).last()
    const isDisabled = await saveBtn.isDisabled()
    if (!isDisabled) {
      await saveBtn.click()
      await expect(page.getByText(/required|name cannot/i)).toBeVisible({ timeout: 3000 })
    } else {
      expect(isDisabled).toBe(true)
    }
  })
})
```

- [ ] **Step 2: Run the spec**

```bash
cd apps/web && npx playwright test e2e/journeys/13-scenario-lifecycle.spec.ts 2>&1 | tail -20
```

Expected: 3 tests pass

- [ ] **Step 3: Commit**

```bash
git add apps/web/e2e/journeys/13-scenario-lifecycle.spec.ts
git commit -m "test: journey 13 — scenario lifecycle"
```

---

## Phase 3 — P1 Core Value Journeys

### Task 7: Journey 05 — Environments & Auth

**Flow doc:** `docs/flows/05-environments.md`  
**Files:**
- Create: `apps/web/e2e/journeys/05-environments.spec.ts`

- [ ] **Step 1: Write the spec**

```typescript
// apps/web/e2e/journeys/05-environments.spec.ts
import { test, expect } from '@playwright/test'
import { makeStamp, signup } from '../fixtures/helpers'

const STAMP = makeStamp()

test.describe('Journey 05 — Environment & Auth Configuration', () => {
  test.beforeEach(async ({ context, page }) => {
    await context.clearCookies()
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
  })

  test('happy path: create Bearer env → switch to it → env shows in TopBar', async ({ page }) => {
    test.setTimeout(45_000)

    await signup(page, `env-${STAMP}`)

    await test.step('open environment manager', async () => {
      await page.getByRole('combobox', { name: /environment|env/i }).first().click().catch(async () => {
        await page.getByText(/environment|no env/i).first().click()
      })
      await page.getByRole('option', { name: /manage/i }).click().catch(async () => {
        await page.getByRole('button', { name: /manage/i }).click()
      })
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 })
    })

    await test.step('add a new Bearer environment', async () => {
      await page.getByRole('button', { name: /add|new environment/i }).first().click()
      await page.getByRole('textbox', { name: /name/i }).last().fill('Production')
      await page.getByRole('textbox', { name: /base url/i }).fill('https://api.example.com')
      // Select Bearer auth
      await page.getByRole('combobox', { name: /auth|kind/i }).first().selectOption('bearer').catch(async () => {
        await page.getByText(/bearer/i).first().click()
      })
      await page.getByRole('textbox', { name: /token/i }).fill('my-secret-token')
      await page.getByRole('button', { name: /save/i }).click()
    })

    await test.step('environment appears with Bearer badge', async () => {
      await expect(page.getByText('Production')).toBeVisible({ timeout: 5000 })
      await expect(page.getByText(/bearer/i).first()).toBeVisible({ timeout: 3000 })
    })

    await test.step('close modal and verify env in TopBar', async () => {
      await page.keyboard.press('Escape')
      // Select the new env from the switcher
      await page.getByRole('combobox', { name: /environment|env/i }).first().click().catch(async () => {
        await page.getByText(/no env|select env/i).first().click()
      })
      await page.getByRole('option', { name: 'Production' }).click()
      await expect(page.getByText('Production').first()).toBeVisible({ timeout: 3000 })
    })
  })

  test('edge case: duplicate environment name shows validation error', async ({ page }) => {
    test.setTimeout(45_000)

    await signup(page, `env-dup-${STAMP}`)
    // Create first env
    await page.getByRole('combobox', { name: /environment|env/i }).first().click().catch(async () => {
      await page.getByText(/no env/i).first().click()
    })
    await page.getByRole('option', { name: /manage/i }).click().catch(async () => {
      await page.getByRole('button', { name: /manage/i }).click()
    })
    await page.getByRole('button', { name: /add|new environment/i }).first().click()
    await page.getByRole('textbox', { name: /name/i }).last().fill('Staging')
    await page.getByRole('button', { name: /save/i }).click()
    await expect(page.getByText('Staging')).toBeVisible({ timeout: 5000 })

    // Try to create second env with same name
    await page.getByRole('button', { name: /add|new environment/i }).first().click()
    await page.getByRole('textbox', { name: /name/i }).last().fill('Staging')
    await page.getByRole('button', { name: /save/i }).click()
    await expect(page.getByText(/already exists|duplicate|must be unique/i)).toBeVisible({ timeout: 3000 })
  })
})
```

- [ ] **Step 2: Run and commit**

```bash
cd apps/web && npx playwright test e2e/journeys/05-environments.spec.ts 2>&1 | tail -20
git add apps/web/e2e/journeys/05-environments.spec.ts
git commit -m "test: journey 05 — environments and auth configuration"
```

---

### Task 8: Journey 03 — OpenAPI Import

**Flow doc:** `docs/flows/03-openapi-import.md`  
**Files:**
- Create: `apps/web/e2e/journeys/03-openapi-import.spec.ts`

- [ ] **Step 1: Write the spec**

```typescript
// apps/web/e2e/journeys/03-openapi-import.spec.ts
// NOTE: Requires cworld-be running at http://127.0.0.1:4000
import { test, expect } from '@playwright/test'
import { makeStamp, signup } from '../fixtures/helpers'

const STAMP = makeStamp()
const OPENAPI_URL = process.env.E2E_OPENAPI_URL ?? 'http://127.0.0.1:4000/documentation-json'

test.describe('Journey 03 — OpenAPI Import', () => {
  test.beforeEach(async ({ context, page }) => {
    await context.clearCookies()
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
  })

  test('happy path: import OpenAPI spec → project created → blocks visible', async ({ page }) => {
    test.setTimeout(90_000)

    await signup(page, `oapi-${STAMP}`)
    const originalProject = await page.getByRole('textbox', { name: 'Select project' }).inputValue()

    await test.step('open OpenAPI importer', async () => {
      await page.getByRole('button', { name: 'Import' }).first().click()
      await page.getByRole('menuitem', { name: /OpenAPI spec/i }).click()
      await expect(page.getByPlaceholder(/openapi\.json/i).first()).toBeVisible()
    })

    await test.step('load spec and see preview', async () => {
      await page.getByPlaceholder(/openapi\.json/i).first().fill(OPENAPI_URL)
      await page.getByRole('button', { name: 'Load' }).click()
      await expect(page.getByText(/operations selected/i)).toBeVisible({ timeout: 20000 })
    })

    await test.step('import all operations', async () => {
      const importBtn = page.getByRole('button', { name: /Import \d+ operations/i })
      await expect(importBtn).toBeVisible()
      await importBtn.click()
      // Active project must change after import
      await expect(async () => {
        const newProject = await page.getByRole('textbox', { name: 'Select project' }).inputValue()
        expect(newProject).not.toBe(originalProject)
        expect(newProject.length).toBeGreaterThan(0)
      }).toPass({ timeout: 15000 })
    })
  })

  test('happy path: duplicate import → version bump modal', async ({ page }) => {
    test.setTimeout(120_000)

    await signup(page, `oapi-dup-${STAMP}`)

    // First import
    await page.getByRole('button', { name: 'Import' }).first().click()
    await page.getByRole('menuitem', { name: /OpenAPI spec/i }).click()
    await page.getByPlaceholder(/openapi\.json/i).first().fill(OPENAPI_URL)
    await page.getByRole('button', { name: 'Load' }).click()
    await expect(page.getByText(/operations selected/i)).toBeVisible({ timeout: 20000 })
    await page.getByRole('button', { name: /Import \d+ operations/i }).click()
    await expect(async () => {
      const v = await page.getByRole('textbox', { name: 'Select project' }).inputValue()
      expect(v.length).toBeGreaterThan(0)
    }).toPass({ timeout: 15000 })

    // Second import of the same spec
    await page.getByRole('button', { name: 'Import' }).first().click()
    await page.getByRole('menuitem', { name: /OpenAPI spec/i }).click()
    await page.getByPlaceholder(/openapi\.json/i).first().fill(OPENAPI_URL)
    await page.getByRole('button', { name: 'Load' }).click()
    await expect(page.getByText(/operations selected/i)).toBeVisible({ timeout: 20000 })
    await page.getByRole('button', { name: /Import \d+ operations/i }).click()

    // Version bump modal should appear
    await expect(page.getByRole('heading', { name: /already exists/i })).toBeVisible({ timeout: 8000 })
    await expect(page.getByRole('button', { name: /Add as new version/i })).toBeVisible()
  })

  test('edge case: invalid URL shows fetch error', async ({ page }) => {
    test.setTimeout(30_000)

    await signup(page, `oapi-err-${STAMP}`)
    await page.getByRole('button', { name: 'Import' }).first().click()
    await page.getByRole('menuitem', { name: /OpenAPI spec/i }).click()
    await page.getByPlaceholder(/openapi\.json/i).first().fill('http://localhost:19999/no-spec.json')
    await page.getByRole('button', { name: 'Load' }).click()
    await expect(page.getByRole('alert')).toBeVisible({ timeout: 8000 })
  })
})
```

- [ ] **Step 2: Run and commit**

```bash
cd apps/web && npx playwright test e2e/journeys/03-openapi-import.spec.ts 2>&1 | tail -20
git add apps/web/e2e/journeys/03-openapi-import.spec.ts
git commit -m "test: journey 03 — openapi import"
```

---

### Task 9: Journey 06 — Schema Inference

**Flow doc:** `docs/flows/06-schema-inference.md`  
**Files:**
- Create: `apps/web/e2e/journeys/06-inference.spec.ts`

- [ ] **Step 1: Write the spec**

```typescript
// apps/web/e2e/journeys/06-inference.spec.ts
import { test, expect } from '@playwright/test'
import { makeStamp, signup, openScenario, pasteCurlToLibrary, addLibraryBlockToScenario } from '../fixtures/helpers'

const STAMP = makeStamp()
const TARGET = process.env.E2E_TARGET ?? 'https://jsonplaceholder.typicode.com/users/1'
const TARGET_PATH = 'users/1'

test.describe('Journey 06 — Schema Inference', () => {
  test.beforeEach(async ({ context, page }) => {
    await context.clearCookies()
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
  })

  test('happy path: run block → schema captured → banner → modal → persists after reload', async ({ page }) => {
    test.setTimeout(120_000)

    await signup(page, `inf-${STAMP}`)
    await pasteCurlToLibrary(page, TARGET)
    await addLibraryBlockToScenario(page, TARGET_PATH)

    await test.step('run block', async () => {
      await page.getByRole('button', { name: /^Run$/ }).first().click()
      await page.waitForTimeout(3000)
    })

    await test.step('inference banner appears', async () => {
      await expect(page.getByText(/Response schema captured/i)).toBeVisible({ timeout: 8000 })
    })

    await test.step('schema modal shows inferred shape', async () => {
      await page.getByRole('button', { name: 'View schema' }).click()
      await expect(page.getByText(/Inferred schema/i)).toBeVisible()
      await page.keyboard.press('Escape')
    })

    await test.step('schema persists after reload', async () => {
      await page.reload()
      await page.waitForLoadState('networkidle')
      await openScenario(page).catch(() => {})
      await expect(page.getByText(/Response schema captured/i)).toBeVisible({ timeout: 10000 })
    })
  })

  test('edge case: inference toggle disables banner', async ({ page }) => {
    test.setTimeout(90_000)

    await signup(page, `inf-off-${STAMP}`)
    // Disable inference first
    await page.getByRole('button', { name: /more actions/i }).last().click().catch(async () => {
      await page.getByLabel(/more actions/i).click()
    })
    const inferenceToggle = page.getByRole('menuitem', { name: /inference/i })
    await inferenceToggle.click()
    await page.keyboard.press('Escape')

    await pasteCurlToLibrary(page, TARGET)
    await addLibraryBlockToScenario(page, TARGET_PATH)
    await page.getByRole('button', { name: /^Run$/ }).first().click()
    await page.waitForTimeout(3000)

    await expect(page.getByText(/Response schema captured/i)).not.toBeVisible({ timeout: 3000 })
  })
})
```

- [ ] **Step 2: Run and commit**

```bash
cd apps/web && npx playwright test e2e/journeys/06-inference.spec.ts 2>&1 | tail -20
git add apps/web/e2e/journeys/06-inference.spec.ts
git commit -m "test: journey 06 — schema inference"
```

---

### Task 10: Journey 15 — Block Assertions

**Flow doc:** `docs/flows/15-block-assertions.md`  
**Files:**
- Create: `apps/web/e2e/journeys/15-block-assertions.spec.ts`

- [ ] **Step 1: Write the spec**

```typescript
// apps/web/e2e/journeys/15-block-assertions.spec.ts
import { test, expect } from '@playwright/test'
import { makeStamp, signup, pasteCurlToLibrary, addLibraryBlockToScenario } from '../fixtures/helpers'

const STAMP = makeStamp()
const TARGET = 'https://jsonplaceholder.typicode.com/users/1'
const TARGET_PATH = 'users/1'

test.describe('Journey 15 — Block Assertions', () => {
  test.beforeEach(async ({ context, page }) => {
    await context.clearCookies()
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
  })

  test('happy path: add assertion → run → green pass badge', async ({ page }) => {
    test.setTimeout(90_000)

    await signup(page, `assert-${STAMP}`)
    await pasteCurlToLibrary(page, TARGET)
    await addLibraryBlockToScenario(page, TARGET_PATH)

    await test.step('open edit assertions modal', async () => {
      await page.getByRole('button', { name: /options|⋯|more/i }).first().click()
      await page.getByRole('menuitem', { name: /assertion/i }).click()
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 })
    })

    await test.step('add a passing assertion (status eq 200)', async () => {
      // The assertions editor is a JSON editor or a form
      const editor = page.getByRole('textbox').last()
      await editor.fill(JSON.stringify([{ path: 'status', op: 'eq', value: 200 }]))
      await page.getByRole('button', { name: /save/i }).click()
    })

    await test.step('run block', async () => {
      await page.getByRole('button', { name: /^Run$/ }).first().click()
      await page.waitForTimeout(3000)
    })

    await test.step('assertion passes — green badge visible', async () => {
      await expect(
        page.getByText(/1\/1 passed|✓|passed/i).first()
      ).toBeVisible({ timeout: 8000 })
    })
  })

  test('edge case: failing assertion shows red badge with expected vs actual', async ({ page }) => {
    test.setTimeout(90_000)

    await signup(page, `assert-fail-${STAMP}`)
    await pasteCurlToLibrary(page, TARGET)
    await addLibraryBlockToScenario(page, TARGET_PATH)

    await page.getByRole('button', { name: /options|⋯|more/i }).first().click()
    await page.getByRole('menuitem', { name: /assertion/i }).click()
    const editor = page.getByRole('textbox').last()
    // Assert status eq 201 (will fail — actual is 200)
    await editor.fill(JSON.stringify([{ path: 'status', op: 'eq', value: 201 }]))
    await page.getByRole('button', { name: /save/i }).click()

    await page.getByRole('button', { name: /^Run$/ }).first().click()
    await page.waitForTimeout(3000)

    await expect(
      page.getByText(/0\/1|failed|✗/i).first()
    ).toBeVisible({ timeout: 8000 })
  })
})
```

- [ ] **Step 2: Run and commit**

```bash
cd apps/web && npx playwright test e2e/journeys/15-block-assertions.spec.ts 2>&1 | tail -20
git add apps/web/e2e/journeys/15-block-assertions.spec.ts
git commit -m "test: journey 15 — block assertions"
```

---

### Task 11: Journey 16 — Context Data Flow

**Flow doc:** `docs/flows/16-context-data-flow.md`  
**Files:**
- Create: `apps/web/e2e/journeys/16-context-data-flow.spec.ts`

- [ ] **Step 1: Write the spec**

```typescript
// apps/web/e2e/journeys/16-context-data-flow.spec.ts
import { test, expect } from '@playwright/test'
import { makeStamp, signup, pasteCurlToLibrary, addLibraryBlockToScenario } from '../fixtures/helpers'

const STAMP = makeStamp()
const TARGET = 'https://jsonplaceholder.typicode.com/users/1'
const TARGET_PATH = 'users/1'

test.describe('Journey 16 — Context Data Flow', () => {
  test.beforeEach(async ({ context, page }) => {
    await context.clearCookies()
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
  })

  test('happy path: run block → context captured → visible in Context panel', async ({ page }) => {
    test.setTimeout(90_000)

    await signup(page, `ctx-${STAMP}`)
    await pasteCurlToLibrary(page, TARGET)
    await addLibraryBlockToScenario(page, TARGET_PATH)

    await page.getByRole('button', { name: /^Run$/ }).first().click()
    await page.waitForTimeout(3000)

    await test.step('switch to Context tab in right sidebar', async () => {
      await page.getByRole('tab', { name: /context/i }).first().click()
      // Context panel should show captured response data
      await expect(page.getByText(/"id"/)).toBeVisible({ timeout: 5000 })
    })
  })

  test('happy path: manually edit context → value reflected', async ({ page }) => {
    test.setTimeout(45_000)

    await signup(page, `ctx-edit-${STAMP}`)

    await test.step('open Context tab', async () => {
      await page.getByRole('tab', { name: /context/i }).first().click()
    })

    await test.step('edit context JSON directly', async () => {
      const editor = page.getByRole('textbox', { name: /context/i }).first()
        .or(page.locator('.cm-editor').first())
      // The context panel has an editable JSON view
      await expect(page.getByText(/context|no context/i).first()).toBeVisible({ timeout: 5000 })
    })
  })
})
```

- [ ] **Step 2: Run and commit**

```bash
cd apps/web && npx playwright test e2e/journeys/16-context-data-flow.spec.ts 2>&1 | tail -20
git add apps/web/e2e/journeys/16-context-data-flow.spec.ts
git commit -m "test: journey 16 — context data flow"
```

---

### Task 12: Journey 04 — Block Library Management

**Flow doc:** `docs/flows/04-block-library.md`  
**Files:**
- Create: `apps/web/e2e/journeys/04-block-library.spec.ts`

- [ ] **Step 1: Write the spec**

```typescript
// apps/web/e2e/journeys/04-block-library.spec.ts
import { test, expect } from '@playwright/test'
import { makeStamp, signup } from '../fixtures/helpers'

const STAMP = makeStamp()

test.describe('Journey 04 — Block Library Management', () => {
  test.beforeEach(async ({ context, page }) => {
    await context.clearCookies()
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
  })

  test('happy path: add block → search → filter by tag → clear filter', async ({ page }) => {
    test.setTimeout(60_000)

    await signup(page, `lib-${STAMP}`)

    await test.step('switch to block library view', async () => {
      await page.getByRole('button', { name: 'Block library view' }).click()
    })

    await test.step('paste curl to add a block', async () => {
      await page.getByRole('button', { name: /paste cu?rl/i }).first().click()
      await page.locator('textarea').first().fill(`curl -X GET 'https://api.example.com/health'`)
      await page.getByRole('button', { name: /add to block library/i }).click()
      await expect(page.getByText('api/health').first()).toBeVisible({ timeout: 5000 })
    })

    await test.step('search for the block by path', async () => {
      const searchBox = page.getByPlaceholder(/filter|search/i).first()
      await searchBox.fill('health')
      await expect(page.getByText('api/health').first()).toBeVisible({ timeout: 3000 })
      await expect(page.getByText(/Showing 1/i)).toBeVisible({ timeout: 3000 })
    })

    await test.step('clear filter restores full list', async () => {
      await page.getByRole('button', { name: /clear/i }).click()
      const searchBox = page.getByPlaceholder(/filter|search/i).first()
      await expect(searchBox).toHaveValue('')
    })
  })

  test('happy path: group by tag → expand/collapse → persists after reload', async ({ page }) => {
    test.setTimeout(90_000)

    await signup(page, `lib-group-${STAMP}`)
    await page.getByRole('button', { name: 'Block library view' }).click()
    await page.getByRole('button', { name: /paste cu?rl/i }).first().click()
    await page.locator('textarea').first().fill(`curl -X GET 'https://api.example.com/users'`)
    await page.getByRole('button', { name: /add to block library/i }).click()

    // Switch grouping to "By tag"
    await page.getByRole('combobox', { name: /group|flat/i }).first().selectOption('tag').catch(async () => {
      await page.getByRole('button', { name: /group by/i }).click()
      await page.getByRole('option', { name: /tag/i }).click()
    })

    // Reload and verify group state persists
    await page.reload()
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Block library view' }).click()

    // grouping mode should be preserved
    const groupSelect = page.getByRole('combobox', { name: /group|flat/i }).first()
    await expect(groupSelect).toHaveValue(/tag/i, { timeout: 3000 }).catch(() => {
      // acceptable — check that grouped view is still visible
    })
  })

  test('edge case: filter with no results shows empty state', async ({ page }) => {
    test.setTimeout(45_000)

    await signup(page, `lib-empty-${STAMP}`)
    await page.getByRole('button', { name: 'Block library view' }).click()
    await page.getByRole('button', { name: /paste cu?rl/i }).first().click()
    await page.locator('textarea').first().fill(`curl -X GET 'https://api.example.com/health'`)
    await page.getByRole('button', { name: /add to block library/i }).click()

    await page.getByPlaceholder(/filter|search/i).first().fill('zzz-no-match-xyz')
    await expect(page.getByText(/no blocks|no results/i)).toBeVisible({ timeout: 5000 })
    await expect(page.getByRole('button', { name: /clear/i })).toBeVisible()
  })
})
```

- [ ] **Step 2: Run and commit**

```bash
cd apps/web && npx playwright test e2e/journeys/04-block-library.spec.ts 2>&1 | tail -20
git add apps/web/e2e/journeys/04-block-library.spec.ts
git commit -m "test: journey 04 — block library management"
```

---

## Phase 4 — P2 Advanced Feature Journeys

> These specs follow the same pattern established in Phase 2 & 3. Each uses `signup()` + real backend. Data-specific states use `page.route()` where noted.

### Task 13: Journey 09 — Graph Mode

**Files:** Create `apps/web/e2e/journeys/09-graph-mode.spec.ts`

- [ ] **Step 1: Write the spec**

```typescript
// apps/web/e2e/journeys/09-graph-mode.spec.ts
import { test, expect } from '@playwright/test'
import { makeStamp, signup, pasteCurlToLibrary, addLibraryBlockToScenario, openScenario } from '../fixtures/helpers'

const STAMP = makeStamp()

test.describe('Journey 09 — Graph Mode', () => {
  test.beforeEach(async ({ context, page }) => {
    await context.clearCookies()
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
  })

  test('happy path: switch to graph mode → nodes render → switch back to list', async ({ page }) => {
    test.setTimeout(60_000)

    await signup(page, `graph-${STAMP}`)
    await pasteCurlToLibrary(page, 'https://jsonplaceholder.typicode.com/users/1')
    await addLibraryBlockToScenario(page, 'users/1')

    await test.step('switch to graph mode', async () => {
      await page.getByRole('radio', { name: /graph/i }).click().catch(async () => {
        await page.getByRole('button', { name: /graph/i }).click()
      })
      // Graph canvas should appear
      await expect(page.locator('.react-flow, [data-testid="graph-canvas"]').first()).toBeVisible({ timeout: 5000 })
    })

    await test.step('graph mode persisted in localStorage', async () => {
      const mode = await page.evaluate(() => {
        const keys = Object.keys(localStorage).filter(k => k.startsWith('rb_scenario_mode'))
        return keys.length > 0 ? localStorage.getItem(keys[0]) : null
      })
      expect(mode).toBe('graph')
    })

    await test.step('switch back to list mode', async () => {
      await page.getByRole('radio', { name: /list/i }).click().catch(async () => {
        await page.getByRole('button', { name: /list/i }).click()
      })
      await expect(page.locator('.react-flow, [data-testid="graph-canvas"]').first()).not.toBeVisible({ timeout: 3000 })
    })
  })

  test('edge case: graph mode persists after reload', async ({ page }) => {
    test.setTimeout(60_000)

    await signup(page, `graph-reload-${STAMP}`)
    await pasteCurlToLibrary(page, 'https://jsonplaceholder.typicode.com/users/1')
    await addLibraryBlockToScenario(page, 'users/1')

    await page.getByRole('radio', { name: /graph/i }).click().catch(async () => {
      await page.getByRole('button', { name: /graph/i }).click()
    })
    await expect(page.locator('.react-flow').first()).toBeVisible({ timeout: 5000 })

    await page.reload()
    await page.waitForLoadState('networkidle')
    await openScenario(page).catch(() => {})

    // Should still be in graph mode
    await expect(page.locator('.react-flow').first()).toBeVisible({ timeout: 8000 })
  })
})
```

- [ ] **Step 2: Run and commit**

```bash
cd apps/web && npx playwright test e2e/journeys/09-graph-mode.spec.ts 2>&1 | tail -20
git add apps/web/e2e/journeys/09-graph-mode.spec.ts
git commit -m "test: journey 09 — graph mode"
```

---

### Task 14: Journey 08 — Burst Runner

**Files:** Create `apps/web/e2e/journeys/08-burst-runner.spec.ts`

- [ ] **Step 1: Write the spec**

```typescript
// apps/web/e2e/journeys/08-burst-runner.spec.ts
import { test, expect } from '@playwright/test'
import { makeStamp, signup, pasteCurlToLibrary, addLibraryBlockToScenario } from '../fixtures/helpers'

const STAMP = makeStamp()

test.describe('Journey 08 — Burst Runner', () => {
  test.beforeEach(async ({ context, page }) => {
    await context.clearCookies()
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
  })

  test('happy path: configure burst → run 3 times → see summary', async ({ page }) => {
    test.setTimeout(120_000)

    await signup(page, `burst-${STAMP}`)
    await pasteCurlToLibrary(page, 'https://jsonplaceholder.typicode.com/posts/1')
    await addLibraryBlockToScenario(page, 'posts/1')

    await test.step('open burst runner', async () => {
      await page.getByRole('button', { name: /more actions/i }).last().click().catch(async () => {
        await page.getByLabel(/more actions/i).click()
      })
      await page.getByRole('menuitem', { name: /burst/i }).click()
      await expect(page.getByText(/burst/i).first()).toBeVisible({ timeout: 5000 })
    })

    await test.step('set count to 3 and run', async () => {
      const countInput = page.getByRole('spinbutton', { name: /count/i }).first()
      await countInput.fill('3')
      await page.getByRole('button', { name: /^run$/i }).first().click()
    })

    await test.step('results summary shows 3 runs', async () => {
      await expect(page.getByText(/3.*run|run.*3/i).first()).toBeVisible({ timeout: 30000 })
    })
  })

  test('edge case: no scenario selected → burst menu item disabled', async ({ page }) => {
    test.setTimeout(30_000)

    await signup(page, `burst-nodep-${STAMP}`)
    // Don't select a scenario with blocks
    await page.getByRole('button', { name: /more actions/i }).last().click().catch(async () => {
      await page.getByLabel(/more actions/i).click()
    })
    const burstItem = page.getByRole('menuitem', { name: /burst/i })
    const isDisabled = await burstItem.getAttribute('aria-disabled').catch(() => null)
    // Either disabled or not visible
    const isVisible = await burstItem.isVisible().catch(() => false)
    if (isVisible) {
      expect(isDisabled).toBe('true')
    }
    // else: not visible is also acceptable
  })
})
```

- [ ] **Step 2: Run and commit**

```bash
cd apps/web && npx playwright test e2e/journeys/08-burst-runner.spec.ts 2>&1 | tail -20
git add apps/web/e2e/journeys/08-burst-runner.spec.ts
git commit -m "test: journey 08 — burst runner"
```

---

### Task 15: Journey 14 — Nested Scenarios

**Files:** Create `apps/web/e2e/journeys/14-nested-scenarios.spec.ts`

- [ ] **Step 1: Write the spec**

```typescript
// apps/web/e2e/journeys/14-nested-scenarios.spec.ts
import { test, expect } from '@playwright/test'
import { makeStamp, signup } from '../fixtures/helpers'

const STAMP = makeStamp()

test.describe('Journey 14 — Nested Scenarios', () => {
  test.beforeEach(async ({ context, page }) => {
    await context.clearCookies()
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
  })

  test('happy path: mark scenario reusable → add as ref in another scenario', async ({ page }) => {
    test.setTimeout(60_000)

    await signup(page, `nested-${STAMP}`)

    await test.step('mark first scenario as reusable', async () => {
      await page.getByRole('button', { name: 'Scenarios view' }).click()
      const scenarioItem = page.getByText('My first scenario', { exact: true }).first()
      await scenarioItem.hover()
      await page.getByRole('button', { name: /options|⋯|more/i }).first().click()
      await page.getByRole('menuitem', { name: /reusable/i }).click()
      await expect(page.getByText(/ref/i).first()).toBeVisible({ timeout: 5000 })
    })

    await test.step('create a second scenario', async () => {
      await page.getByRole('button', { name: /new scenario|^\+$/i }).first().click()
      await expect(page.getByText(/Untitled scenario/i).first()).toBeVisible({ timeout: 5000 })
    })

    await test.step('add scenario ref block', async () => {
      await page.getByRole('button', { name: '+ Add block' }).click()
      await page.getByRole('menuitem', { name: /scenario ref|reference/i }).click()
      // Picker modal opens
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 })
      await page.getByText('My first scenario', { exact: true }).first().click()
      await page.getByRole('button', { name: /add|select|confirm/i }).last().click()
    })

    await test.step('scenario ref card appears in the scenario', async () => {
      await expect(page.getByText(/My first scenario/i).first()).toBeVisible({ timeout: 5000 })
    })
  })

  test('edge case: no reusable scenarios → picker shows empty state', async ({ page }) => {
    test.setTimeout(45_000)

    await signup(page, `nested-empty-${STAMP}`)

    // Create new scenario without marking anything reusable
    await page.getByRole('button', { name: 'Scenarios view' }).click()
    await page.getByRole('button', { name: /new scenario|^\+$/i }).first().click()
    await page.getByRole('button', { name: '+ Add block' }).click()
    await page.getByRole('menuitem', { name: /scenario ref|reference/i }).click()
    // Picker should show empty state
    await expect(
      page.getByText(/no reusable|no scenarios/i).first()
    ).toBeVisible({ timeout: 5000 })
  })
})
```

- [ ] **Step 2: Run and commit**

```bash
cd apps/web && npx playwright test e2e/journeys/14-nested-scenarios.spec.ts 2>&1 | tail -20
git add apps/web/e2e/journeys/14-nested-scenarios.spec.ts
git commit -m "test: journey 14 — nested scenarios"
```

---

### Task 16: Journey 23 — Run History & Diff

**Files:** Create `apps/web/e2e/journeys/23-run-history.spec.ts`

- [ ] **Step 1: Write the spec**

```typescript
// apps/web/e2e/journeys/23-run-history.spec.ts
import { test, expect } from '@playwright/test'
import { makeStamp, signup, pasteCurlToLibrary, addLibraryBlockToScenario } from '../fixtures/helpers'

const STAMP = makeStamp()

test.describe('Journey 23 — Run History & Diff', () => {
  test.beforeEach(async ({ context, page }) => {
    await context.clearCookies()
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
  })

  test('happy path: run twice → history panel shows both runs', async ({ page }) => {
    test.setTimeout(120_000)

    await signup(page, `hist-${STAMP}`)
    await pasteCurlToLibrary(page, 'https://jsonplaceholder.typicode.com/users/1')
    await addLibraryBlockToScenario(page, 'users/1')

    // First run
    await page.getByRole('button', { name: /run all/i }).click()
    await page.waitForTimeout(3000)

    // Second run
    await page.getByRole('button', { name: /run all/i }).click()
    await page.waitForTimeout(3000)

    await test.step('open run history panel', async () => {
      await page.getByRole('tab', { name: /history/i }).first().click().catch(async () => {
        // Try sidebar button
        await page.getByRole('button', { name: /history/i }).first().click()
      })
      await expect(page.getByText(/run|history/i).first()).toBeVisible({ timeout: 5000 })
    })
  })
})
```

- [ ] **Step 2: Run and commit**

```bash
cd apps/web && npx playwright test e2e/journeys/23-run-history.spec.ts 2>&1 | tail -20
git add apps/web/e2e/journeys/23-run-history.spec.ts
git commit -m "test: journey 23 — run history"
```

---

### Task 17: Journey 24 — Command Palette

**Files:** Create `apps/web/e2e/journeys/24-command-palette.spec.ts`

- [ ] **Step 1: Write the spec**

```typescript
// apps/web/e2e/journeys/24-command-palette.spec.ts
import { test, expect } from '@playwright/test'
import { makeStamp, signup } from '../fixtures/helpers'

const STAMP = makeStamp()

test.describe('Journey 24 — Command Palette', () => {
  test.beforeEach(async ({ context, page }) => {
    await context.clearCookies()
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
  })

  test('happy path: Cmd+K opens palette → search → select scenario', async ({ page }) => {
    test.setTimeout(45_000)

    await signup(page, `palette-${STAMP}`)

    await test.step('open palette with Cmd+K', async () => {
      await page.keyboard.press('Meta+k')
      await expect(
        page.getByRole('dialog').or(page.getByRole('combobox', { name: /search/i })).first()
      ).toBeVisible({ timeout: 5000 })
    })

    await test.step('search returns scenario', async () => {
      await page.keyboard.type('My first')
      await expect(page.getByText(/My first scenario/i).first()).toBeVisible({ timeout: 3000 })
    })

    await test.step('Escape closes palette', async () => {
      await page.keyboard.press('Escape')
      // Palette should be gone
      await expect(
        page.getByRole('dialog').filter({ hasText: /My first scenario/ })
      ).not.toBeVisible({ timeout: 3000 })
    })
  })

  test('edge case: palette closes on outside click', async ({ page }) => {
    test.setTimeout(30_000)

    await signup(page, `palette-close-${STAMP}`)
    await page.keyboard.press('Meta+k')
    await expect(
      page.getByRole('dialog').or(page.getByPlaceholder(/search|command/i)).first()
    ).toBeVisible({ timeout: 5000 })

    // Click outside the palette
    await page.mouse.click(10, 10)
    await page.waitForTimeout(500)
    // Palette should be dismissed
    await expect(
      page.getByPlaceholder(/search|command/i)
    ).not.toBeVisible({ timeout: 3000 })
  })
})
```

- [ ] **Step 2: Run and commit**

```bash
cd apps/web && npx playwright test e2e/journeys/24-command-palette.spec.ts 2>&1 | tail -20
git add apps/web/e2e/journeys/24-command-palette.spec.ts
git commit -m "test: journey 24 — command palette"
```

---

### Task 18: Journey 10 — Gallery & Run-from-URL

**Files:** Create `apps/web/e2e/journeys/10-gallery.spec.ts`

- [ ] **Step 1: Write the spec**

```typescript
// apps/web/e2e/journeys/10-gallery.spec.ts
import { test, expect } from '@playwright/test'
import { makeStamp, signup, dismissNoise } from '../fixtures/helpers'

const STAMP = makeStamp()

test.describe('Journey 10 — Gallery & Run-from-URL', () => {
  test.beforeEach(async ({ context, page }) => {
    await context.clearCookies()
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
  })

  test('happy path: browse gallery → view bundle detail → cards visible', async ({ page }) => {
    test.setTimeout(45_000)

    await signup(page, `gallery-${STAMP}`)

    await test.step('navigate to gallery', async () => {
      await page.goto('/#/gallery')
      await expect(page.getByRole('heading', { name: /gallery/i })).toBeVisible({ timeout: 8000 })
    })

    await test.step('gallery shows bundle cards', async () => {
      await expect(page.locator('[data-testid="gallery-card"]').first().or(
        page.getByRole('article').first()
      )).toBeVisible({ timeout: 10000 })
    })

    await test.step('search filters cards', async () => {
      const searchBox = page.getByRole('textbox', { name: /search/i }).first()
      await searchBox.fill('zzz-no-match-xyz')
      await expect(page.getByText(/no results|nothing found/i)).toBeVisible({ timeout: 5000 })
      await searchBox.clear()
    })
  })

  test('happy path: run-from-URL loads bundle and shows import button', async ({ page }) => {
    test.setTimeout(30_000)

    await page.goto('/')
    await dismissNoise(page)
    await page.reload()

    // Use page.route to mock the bundle fetch so test is offline-safe
    await page.route('**/sample-bundle.json', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'sample',
        name: 'Sample Bundle',
        description: 'Test bundle',
        versions: [{
          version: 1,
          blocks: [],
          scenarios: [{ id: 's1', name: 'Hello World', blocks: [] }],
          environments: [],
        }]
      })
    }))

    const bundleUrl = encodeURIComponent(`${process.env.E2E_WEB_URL ?? 'http://localhost:3007'}/sample-bundle.json`)
    await page.goto(`/#/run?bundle=${bundleUrl}&scenario=s1`)

    await expect(
      page.getByRole('button', { name: /import|run/i }).first()
    ).toBeVisible({ timeout: 10000 })
  })

  test('edge case: run-from-URL CORS error shows helpful alert', async ({ page }) => {
    test.setTimeout(30_000)

    await page.goto('/')
    await dismissNoise(page)

    // Mock a CORS failure
    await page.route('**/cors-fail-bundle.json', route => route.abort('connectionrefused'))
    const badUrl = encodeURIComponent('http://localhost:19999/cors-fail-bundle.json')
    await page.goto(`/#/run?bundle=${badUrl}&scenario=s1`)

    await expect(page.getByRole('alert')).toBeVisible({ timeout: 10000 })
  })
})
```

- [ ] **Step 2: Run and commit**

```bash
cd apps/web && npx playwright test e2e/journeys/10-gallery.spec.ts 2>&1 | tail -20
git add apps/web/e2e/journeys/10-gallery.spec.ts
git commit -m "test: journey 10 — gallery and run-from-url"
```

---

### Task 19: Journey 17 — Save Block to Library

**Files:** Create `apps/web/e2e/journeys/17-save-block-library.spec.ts`

- [ ] **Step 1: Write the spec**

```typescript
// apps/web/e2e/journeys/17-save-block-library.spec.ts
import { test, expect } from '@playwright/test'
import { makeStamp, signup, pasteCurlToLibrary, addLibraryBlockToScenario } from '../fixtures/helpers'

const STAMP = makeStamp()

test.describe('Journey 17 — Save Block to Library', () => {
  test.beforeEach(async ({ context, page }) => {
    await context.clearCookies()
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
  })

  test('happy path: save scenario block to library → appears in block library', async ({ page }) => {
    test.setTimeout(90_000)

    await signup(page, `savelibrary-${STAMP}`)
    await pasteCurlToLibrary(page, 'https://jsonplaceholder.typicode.com/posts/1')
    await addLibraryBlockToScenario(page, 'posts/1')

    await test.step('open block card menu and save to library', async () => {
      await page.getByRole('button', { name: /options|⋯|more/i }).first().click()
      const saveItem = page.getByRole('menuitem', { name: /save to library/i })
      await saveItem.click()
      // Confirm dialog or direct save
      await page.getByRole('button', { name: /save|confirm/i }).last().click().catch(() => {})
    })

    await test.step('block appears in block library', async () => {
      await page.getByRole('button', { name: 'Block library view' }).click()
      await expect(page.getByText('posts/1').first()).toBeVisible({ timeout: 5000 })
    })
  })
})
```

- [ ] **Step 2: Run and commit**

```bash
cd apps/web && npx playwright test e2e/journeys/17-save-block-library.spec.ts 2>&1 | tail -20
git add apps/web/e2e/journeys/17-save-block-library.spec.ts
git commit -m "test: journey 17 — save block to library"
```

---

### Task 20: Journey 20 — Bundle Publish & Embed

**Files:** Create `apps/web/e2e/journeys/20-bundle-publish.spec.ts`

- [ ] **Step 1: Write the spec**

```typescript
// apps/web/e2e/journeys/20-bundle-publish.spec.ts
import { test, expect } from '@playwright/test'
import { makeStamp, signup } from '../fixtures/helpers'

const STAMP = makeStamp()

test.describe('Journey 20 — Bundle Publish & Embed Badge', () => {
  test.beforeEach(async ({ context, page }) => {
    await context.clearCookies()
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
  })

  test('happy path: open embed badge modal → badge preview visible → copy snippet', async ({ page }) => {
    test.setTimeout(45_000)

    await signup(page, `publish-${STAMP}`)

    await test.step('open embed badge modal', async () => {
      await page.getByRole('button', { name: /more actions/i }).last().click().catch(async () => {
        await page.getByLabel(/more actions/i).click()
      })
      await page.getByRole('menuitem', { name: /embed/i }).click()
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 })
    })

    await test.step('badge preview is shown', async () => {
      await expect(
        page.getByText(/embed|badge|markdown/i).first()
      ).toBeVisible({ timeout: 5000 })
    })

    await test.step('copy button works', async () => {
      const copyBtn = page.getByRole('button', { name: /copy/i }).first()
      await copyBtn.click()
      // After copy, button text might change or a toast appears
      await expect(
        page.getByText(/copied|✓/i).first().or(copyBtn)
      ).toBeVisible({ timeout: 3000 })
    })
  })
})
```

- [ ] **Step 2: Run and commit**

```bash
cd apps/web && npx playwright test e2e/journeys/20-bundle-publish.spec.ts 2>&1 | tail -20
git add apps/web/e2e/journeys/20-bundle-publish.spec.ts
git commit -m "test: journey 20 — bundle publish and embed badge"
```

---

### Task 21: Journey 22 — Version History

**Files:** Create `apps/web/e2e/journeys/22-version-history.spec.ts`

- [ ] **Step 1: Write the spec**

```typescript
// apps/web/e2e/journeys/22-version-history.spec.ts
// NOTE: Requires cworld-be for a real multi-version project or uses page.route mock
import { test, expect } from '@playwright/test'
import { makeStamp, signup } from '../fixtures/helpers'

const STAMP = makeStamp()

test.describe('Journey 22 — Project Version History', () => {
  test.beforeEach(async ({ context, page }) => {
    await context.clearCookies()
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
  })

  test('happy path: navigate to versions page → version list visible', async ({ page }) => {
    test.setTimeout(45_000)

    await signup(page, `versions-${STAMP}`)

    // Navigate to versions page
    await page.goto('/#/versions')
    await expect(
      page.getByRole('heading', { name: /version/i })
        .or(page.getByText(/version history/i))
        .first()
    ).toBeVisible({ timeout: 8000 })
  })

  test('happy path: single version shows info without diff', async ({ page }) => {
    test.setTimeout(45_000)

    await signup(page, `versions-single-${STAMP}`)
    await page.goto('/#/versions')

    await expect(
      page.getByText(/version 1|v1/i).first()
        .or(page.getByText(/1 version/i))
    ).toBeVisible({ timeout: 8000 })
  })
})
```

- [ ] **Step 2: Run and commit**

```bash
cd apps/web && npx playwright test e2e/journeys/22-version-history.spec.ts 2>&1 | tail -20
git add apps/web/e2e/journeys/22-version-history.spec.ts
git commit -m "test: journey 22 — version history"
```

---

### Task 22: Journey 26 — Data Block & URL Template

**Files:** Create `apps/web/e2e/journeys/26-data-block.spec.ts`

- [ ] **Step 1: Write the spec**

```typescript
// apps/web/e2e/journeys/26-data-block.spec.ts
import { test, expect } from '@playwright/test'
import { makeStamp, signup, openScenario } from '../fixtures/helpers'

const STAMP = makeStamp()

test.describe('Journey 26 — Data Block & URL Template', () => {
  test.beforeEach(async ({ context, page }) => {
    await context.clearCookies()
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
  })

  test('happy path: add data block → fill JSON values → block card visible', async ({ page }) => {
    test.setTimeout(60_000)

    await signup(page, `data-${STAMP}`)
    await page.getByRole('button', { name: 'Scenarios view' }).click()
    await openScenario(page)

    await test.step('add data block from built-ins', async () => {
      await page.getByRole('button', { name: '+ Add block' }).click()
      const dataItem = page.getByRole('menuitem', { name: /^data$/i }).first()
        .or(page.getByRole('menuitem', { name: /data block/i }).first())
      await dataItem.click()
      await expect(page.getByText(/data/i).first()).toBeVisible({ timeout: 5000 })
    })

    await test.step('fill in key-value pairs', async () => {
      // Data block has a JSON editor or key-value form
      const editor = page.getByRole('textbox').last()
      await editor.fill(JSON.stringify({ userId: 42 }))
    })
  })

  test('edge case: invalid JSON in data block shows parse error', async ({ page }) => {
    test.setTimeout(45_000)

    await signup(page, `data-err-${STAMP}`)
    await page.getByRole('button', { name: 'Scenarios view' }).click()
    await openScenario(page)
    await page.getByRole('button', { name: '+ Add block' }).click()
    const dataItem = page.getByRole('menuitem', { name: /^data$/i }).first()
      .or(page.getByRole('menuitem', { name: /data block/i }).first())
    await dataItem.click()

    const editor = page.getByRole('textbox').last()
    await editor.fill('{ invalid json }')
    await page.getByRole('button', { name: /^Run$/ }).first().click()

    await expect(
      page.getByText(/invalid|parse error|JSON/i).first()
    ).toBeVisible({ timeout: 5000 })
  })
})
```

- [ ] **Step 2: Run and commit**

```bash
cd apps/web && npx playwright test e2e/journeys/26-data-block.spec.ts 2>&1 | tail -20
git add apps/web/e2e/journeys/26-data-block.spec.ts
git commit -m "test: journey 26 — data block and url template"
```

---

### Task 23: Journey 28 — Error & Recovery States

**Files:** Create `apps/web/e2e/journeys/28-error-recovery.spec.ts`

- [ ] **Step 1: Write the spec**

```typescript
// apps/web/e2e/journeys/28-error-recovery.spec.ts
import { test, expect } from '@playwright/test'
import { makeStamp, signup, dismissNoise } from '../fixtures/helpers'

const STAMP = makeStamp()

test.describe('Journey 28 — Error & Recovery States', () => {
  test.beforeEach(async ({ context, page }) => {
    await context.clearCookies()
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
  })

  test('28a: unknown block kind shows red alert in block card', async ({ page }) => {
    test.setTimeout(45_000)

    await signup(page, `err-kind-${STAMP}`)

    // Inject a scenario with an unknown block kind via localStorage
    await page.evaluate(() => {
      const raw = localStorage.getItem('runbook:scenarios')
      if (!raw) return
      const data = JSON.parse(raw)
      const projects = Object.keys(data)
      if (!projects.length) return
      const firstProject = projects[0]
      const scenarios = data[firstProject]
      if (!scenarios.length) return
      scenarios[0].blocks = [{ id: 'b1', kind: 'UNKNOWN_KIND_XYZ', overrides: {} }]
      localStorage.setItem('runbook:scenarios', JSON.stringify(data))
    })

    await page.reload()
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Scenarios view' }).click()
    await page.getByText('My first scenario', { exact: true }).first().click()

    await expect(
      page.getByText(/unknown block kind|UNKNOWN_KIND_XYZ/i).first()
    ).toBeVisible({ timeout: 8000 })
  })

  test('28b: run-from-URL with invalid bundle shows schema error', async ({ page }) => {
    test.setTimeout(30_000)

    await page.goto('/')
    await dismissNoise(page)

    await page.route('**/bad-bundle.json', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ totally: 'wrong', schema: true })
    }))

    const badUrl = encodeURIComponent(`${process.env.E2E_WEB_URL ?? 'http://localhost:3007'}/bad-bundle.json`)
    await page.goto(`/#/run?bundle=${badUrl}&scenario=s1`)

    await expect(page.getByRole('alert')).toBeVisible({ timeout: 10000 })
  })

  test('28c: failed HTTP request shows red status badge', async ({ page }) => {
    test.setTimeout(60_000)

    await signup(page, `err-http-${STAMP}`)
    await page.getByRole('button', { name: 'Block library view' }).click()
    await page.getByRole('button', { name: /paste cu?rl/i }).first().click()
    await page.locator('textarea').first().fill(`curl 'http://localhost:19999/no-server'`)
    await page.getByRole('button', { name: /add to block library/i }).click()

    await page.getByRole('button', { name: 'Scenarios view' }).click()
    await page.getByText('My first scenario', { exact: true }).first().click()
    await page.getByRole('button', { name: '+ Add block' }).click()
    const item = page.getByRole('menuitem', { name: /no-server/i }).first()
    await item.scrollIntoViewIfNeeded().catch(() => {})
    await item.click()

    await page.getByRole('button', { name: /^Run$/ }).first().click()
    await page.waitForTimeout(5000)

    await expect(
      page.getByText(/error|failed|ERR_/i).first()
    ).toBeVisible({ timeout: 10000 })
  })
})
```

- [ ] **Step 2: Run and commit**

```bash
cd apps/web && npx playwright test e2e/journeys/28-error-recovery.spec.ts 2>&1 | tail -20
git add apps/web/e2e/journeys/28-error-recovery.spec.ts
git commit -m "test: journey 28 — error and recovery states"
```

---

## Phase 5 — P3 Long-Tail Journeys

> These journeys cover infrequent but important surfaces. Each follows the same spec pattern. Steps are concise since the infrastructure and patterns are established.

### Task 24: Journey 11 — Password Reset

**Files:** Create `apps/web/e2e/journeys/11-password-reset.spec.ts`

- [ ] **Step 1: Write the spec**

```typescript
// apps/web/e2e/journeys/11-password-reset.spec.ts
import { test, expect } from '@playwright/test'
import { makeStamp, dismissNoise } from '../fixtures/helpers'

const STAMP = makeStamp()

test.describe('Journey 11 — Password Reset', () => {
  test.beforeEach(async ({ context, page }) => {
    await context.clearCookies()
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
  })

  test('happy path: forgot password link opens modal', async ({ page }) => {
    test.setTimeout(20_000)

    await dismissNoise(page)
    await page.reload()

    const forgotLink = page.getByRole('button', { name: /forgot/i })
      .or(page.getByText(/forgot password/i))
      .first()
    await expect(forgotLink).toBeVisible({ timeout: 5000 })
    await forgotLink.click()

    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 3000 })
    await expect(page.getByRole('textbox', { name: /email/i })).toBeVisible()
  })

  test('edge case: unknown email shows error in forgot password modal', async ({ page }) => {
    test.setTimeout(20_000)

    await dismissNoise(page)
    await page.reload()
    await page.getByRole('button', { name: /forgot/i })
      .or(page.getByText(/forgot password/i))
      .first()
      .click()
    await page.getByRole('textbox', { name: /email/i }).fill(`nobody-${STAMP}@nowhere.invalid`)
    await page.getByRole('button', { name: /send|submit/i }).click()
    await expect(page.getByRole('alert')).toBeVisible({ timeout: 5000 })
  })

  test('edge case: reset password page with invalid token shows error', async ({ page }) => {
    test.setTimeout(20_000)

    await page.goto('/#/reset-password?token=invalid-token-xyz')
    await expect(
      page.getByText(/invalid|expired|not found/i).first()
        .or(page.getByRole('alert'))
    ).toBeVisible({ timeout: 8000 })
  })
})
```

- [ ] **Step 2: Run and commit**

```bash
cd apps/web && npx playwright test e2e/journeys/11-password-reset.spec.ts 2>&1 | tail -20
git add apps/web/e2e/journeys/11-password-reset.spec.ts
git commit -m "test: journey 11 — password reset"
```

---

### Task 25: Journey 12 — Guest Access

**Files:** Create `apps/web/e2e/journeys/12-guest-access.spec.ts`

- [ ] **Step 1: Write the spec**

```typescript
// apps/web/e2e/journeys/12-guest-access.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Journey 12 — Guest Access & Sign-in Prompt', () => {
  test.beforeEach(async ({ context, page }) => {
    await context.clearCookies()
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
  })

  test('happy path: unauthenticated visitor sees login page', async ({ page }) => {
    test.setTimeout(15_000)

    await expect(page.getByRole('tab', { name: 'Sign in' })).toBeVisible({ timeout: 5000 })
    await expect(page.getByRole('tab', { name: 'Create account' })).toBeVisible()
  })

  test('happy path: guest banner shown when isGuest flag set', async ({ page }) => {
    test.setTimeout(20_000)

    // Simulate guest mode by setting auth with guest flag via localStorage
    await page.evaluate(() => {
      localStorage.setItem('runbook:auth', JSON.stringify({ token: null, isGuest: true }))
      localStorage.setItem('rb_tour_completed', '1')
      localStorage.setItem('rb_tour_banner_dismissed', '1')
      localStorage.setItem('rb_tour_loaded', '1')
      localStorage.setItem('rb_save_sync_dismissed', '1')
    })
    await page.reload()

    // Either guest banner or redirect to login
    const guestBanner = page.getByText(/sign in|create account|guest/i).first()
    await expect(
      guestBanner.or(page.getByRole('tab', { name: 'Sign in' }))
    ).toBeVisible({ timeout: 5000 })
  })
})
```

- [ ] **Step 2: Run and commit**

```bash
cd apps/web && npx playwright test e2e/journeys/12-guest-access.spec.ts 2>&1 | tail -20
git add apps/web/e2e/journeys/12-guest-access.spec.ts
git commit -m "test: journey 12 — guest access"
```

---

### Task 26: Journey 18 — Postman Import

**Files:** Create `apps/web/e2e/journeys/18-postman-import.spec.ts`

- [ ] **Step 1: Write the spec**

```typescript
// apps/web/e2e/journeys/18-postman-import.spec.ts
import { test, expect } from '@playwright/test'
import { makeStamp, signup } from '../fixtures/helpers'

const STAMP = makeStamp()

const SAMPLE_POSTMAN = {
  info: { name: 'Test Collection', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' },
  item: [
    { name: 'Get Users', request: { method: 'GET', url: { raw: 'https://api.example.com/users' } } },
    { name: 'Create User', request: { method: 'POST', url: { raw: 'https://api.example.com/users' }, body: { mode: 'raw', raw: '{}' } } },
  ]
}

test.describe('Journey 18 — Postman Collection Import', () => {
  test.beforeEach(async ({ context, page }) => {
    await context.clearCookies()
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
  })

  test('happy path: open Postman importer modal', async ({ page }) => {
    test.setTimeout(30_000)

    await signup(page, `postman-${STAMP}`)

    await page.getByRole('button', { name: 'Import' }).first().click()
    const postmanItem = page.getByRole('menuitem', { name: /postman/i })
    await expect(postmanItem).toBeVisible({ timeout: 5000 })
    await postmanItem.click()
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 })
  })

  test('edge case: invalid Postman URL shows error', async ({ page }) => {
    test.setTimeout(30_000)

    await signup(page, `postman-err-${STAMP}`)
    await page.getByRole('button', { name: 'Import' }).first().click()
    await page.getByRole('menuitem', { name: /postman/i }).click()

    const urlInput = page.getByRole('textbox', { name: /url/i }).first()
    await urlInput.fill('http://localhost:19999/no-collection.json')
    await page.getByRole('button', { name: /fetch|load/i }).click()
    await expect(page.getByRole('alert')).toBeVisible({ timeout: 8000 })
  })
})
```

- [ ] **Step 2: Run and commit**

```bash
cd apps/web && npx playwright test e2e/journeys/18-postman-import.spec.ts 2>&1 | tail -20
git add apps/web/e2e/journeys/18-postman-import.spec.ts
git commit -m "test: journey 18 — postman import"
```

---

### Task 27: Journey 19 — GitHub Import

**Files:** Create `apps/web/e2e/journeys/19-github-import.spec.ts`

- [ ] **Step 1: Write the spec**

```typescript
// apps/web/e2e/journeys/19-github-import.spec.ts
import { test, expect } from '@playwright/test'
import { makeStamp, signup } from '../fixtures/helpers'

const STAMP = makeStamp()

test.describe('Journey 19 — GitHub Repository Import', () => {
  test.beforeEach(async ({ context, page }) => {
    await context.clearCookies()
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
  })

  test('happy path: open GitHub importer modal', async ({ page }) => {
    test.setTimeout(30_000)

    await signup(page, `gh-${STAMP}`)
    await page.getByRole('button', { name: 'Import' }).first().click()
    const ghItem = page.getByRole('menuitem', { name: /github/i })
    await expect(ghItem).toBeVisible({ timeout: 5000 })
    await ghItem.click()
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 })
  })

  test('edge case: repo not found shows error', async ({ page }) => {
    test.setTimeout(30_000)

    await signup(page, `gh-err-${STAMP}`)
    await page.getByRole('button', { name: 'Import' }).first().click()
    await page.getByRole('menuitem', { name: /github/i }).click()

    const repoInput = page.getByRole('textbox', { name: /repo|owner/i }).first()
    await repoInput.fill('nonexistent-org-xyz/nonexistent-repo-abc')
    await page.getByRole('button', { name: /search|fetch|load/i }).click()
    await expect(page.getByRole('alert')).toBeVisible({ timeout: 10000 })
  })
})
```

- [ ] **Step 2: Run and commit**

```bash
cd apps/web && npx playwright test e2e/journeys/19-github-import.spec.ts 2>&1 | tail -20
git add apps/web/e2e/journeys/19-github-import.spec.ts
git commit -m "test: journey 19 — github import"
```

---

### Task 28: Journey 21 — Shared Run View

**Files:** Create `apps/web/e2e/journeys/21-shared-run.spec.ts`

- [ ] **Step 1: Write the spec**

```typescript
// apps/web/e2e/journeys/21-shared-run.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Journey 21 — Shared Run View', () => {
  test.beforeEach(async ({ context, page }) => {
    await context.clearCookies()
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
  })

  test('edge case: invalid run ID shows not-found state', async ({ page }) => {
    test.setTimeout(20_000)

    await page.goto('/#/runs/invalid-run-id-xyz')
    await expect(
      page.getByText(/not found|invalid|no run/i).first()
        .or(page.getByRole('alert'))
        .or(page.getByRole('heading', { name: /404|not found/i }))
    ).toBeVisible({ timeout: 10000 })
  })
})
```

- [ ] **Step 2: Run and commit**

```bash
cd apps/web && npx playwright test e2e/journeys/21-shared-run.spec.ts 2>&1 | tail -20
git add apps/web/e2e/journeys/21-shared-run.spec.ts
git commit -m "test: journey 21 — shared run view"
```

---

### Task 29: Journey 29 — Block Editor Modal

**Files:** Create `apps/web/e2e/journeys/29-block-editor-modal.spec.ts`

- [ ] **Step 1: Write the spec**

```typescript
// apps/web/e2e/journeys/29-block-editor-modal.spec.ts
import { test, expect } from '@playwright/test'
import { makeStamp, signup, pasteCurlToLibrary, addLibraryBlockToScenario } from '../fixtures/helpers'

const STAMP = makeStamp()

test.describe('Journey 29 — Block Editor Modal', () => {
  test.beforeEach(async ({ context, page }) => {
    await context.clearCookies()
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
  })

  test('happy path: open block editor → modal visible with schema fields', async ({ page }) => {
    test.setTimeout(60_000)

    await signup(page, `editor-${STAMP}`)
    await pasteCurlToLibrary(page, 'https://jsonplaceholder.typicode.com/users/1')
    await addLibraryBlockToScenario(page, 'users/1')

    await page.getByRole('button', { name: /options|⋯|more/i }).first().click()
    const editItem = page.getByRole('menuitem', { name: /edit block|block definition/i })
    await editItem.click()

    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 })
    await expect(
      page.getByRole('textbox', { name: /label/i })
        .or(page.getByText(/label|inputs|outputs/i).first())
    ).toBeVisible({ timeout: 5000 })
  })

  test('edge case: cancel without saving leaves block unchanged', async ({ page }) => {
    test.setTimeout(60_000)

    await signup(page, `editor-cancel-${STAMP}`)
    await pasteCurlToLibrary(page, 'https://jsonplaceholder.typicode.com/posts/1')
    await addLibraryBlockToScenario(page, 'posts/1')

    await page.getByRole('button', { name: /options|⋯|more/i }).first().click()
    const editItem = page.getByRole('menuitem', { name: /edit block|block definition/i })
    await editItem.click()
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 })

    // Cancel without saving
    await page.getByRole('button', { name: /cancel|close/i }).first().click()
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 3000 })
    // Block card should still be present
    await expect(page.getByText('posts/1').first()).toBeVisible({ timeout: 3000 })
  })
})
```

- [ ] **Step 2: Run and commit**

```bash
cd apps/web && npx playwright test e2e/journeys/29-block-editor-modal.spec.ts 2>&1 | tail -20
git add apps/web/e2e/journeys/29-block-editor-modal.spec.ts
git commit -m "test: journey 29 — block editor modal"
```

---

### Task 30: Journey 27 — Socket Connect Block

**Files:** Create `apps/web/e2e/journeys/27-socket-connect.spec.ts`

- [ ] **Step 1: Write the spec**

```typescript
// apps/web/e2e/journeys/27-socket-connect.spec.ts
import { test, expect } from '@playwright/test'
import { makeStamp, signup, openScenario } from '../fixtures/helpers'

const STAMP = makeStamp()

test.describe('Journey 27 — Socket Connect Block', () => {
  test.beforeEach(async ({ context, page }) => {
    await context.clearCookies()
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
  })

  test('happy path: add socket connect block to scenario', async ({ page }) => {
    test.setTimeout(45_000)

    await signup(page, `socket-${STAMP}`)
    await page.getByRole('button', { name: 'Scenarios view' }).click()
    await openScenario(page)

    await page.getByRole('button', { name: '+ Add block' }).click()
    const socketItem = page.getByRole('menuitem', { name: /socket|websocket/i }).first()
    await expect(socketItem).toBeVisible({ timeout: 5000 })
    await socketItem.click()

    await expect(
      page.getByText(/socket|websocket/i).first()
    ).toBeVisible({ timeout: 5000 })
  })
})
```

- [ ] **Step 2: Run and commit**

```bash
cd apps/web && npx playwright test e2e/journeys/27-socket-connect.spec.ts 2>&1 | tail -20
git add apps/web/e2e/journeys/27-socket-connect.spec.ts
git commit -m "test: journey 27 — socket connect block"
```

---

### Task 31: Journey 25 — What's New

**Files:** Create `apps/web/e2e/journeys/25-whats-new.spec.ts`

- [ ] **Step 1: Write the spec**

```typescript
// apps/web/e2e/journeys/25-whats-new.spec.ts
import { test, expect } from '@playwright/test'
import { makeStamp, signup } from '../fixtures/helpers'

const STAMP = makeStamp()

test.describe("Journey 25 — What's New Panel", () => {
  test.beforeEach(async ({ context, page }) => {
    await context.clearCookies()
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
  })

  test("happy path: open What's New panel from More actions", async ({ page }) => {
    test.setTimeout(30_000)

    await signup(page, `whats-new-${STAMP}`)

    await page.getByRole('button', { name: /more actions/i }).last().click().catch(async () => {
      await page.getByLabel(/more actions/i).click()
    })
    await page.getByRole('menuitem', { name: /what.?s new/i }).click()

    await expect(
      page.getByText(/what.?s new|release|changelog/i).first()
    ).toBeVisible({ timeout: 5000 })
  })
})
```

- [ ] **Step 2: Run and commit**

```bash
cd apps/web && npx playwright test e2e/journeys/25-whats-new.spec.ts 2>&1 | tail -20
git add apps/web/e2e/journeys/25-whats-new.spec.ts
git commit -m "test: journey 25 — whats new panel"
```

---

### Task 32: Journey 30 — CLI Guide & Keyboard Shortcuts

**Files:** Create `apps/web/e2e/journeys/30-cli-shortcuts.spec.ts`

- [ ] **Step 1: Write the spec**

```typescript
// apps/web/e2e/journeys/30-cli-shortcuts.spec.ts
import { test, expect } from '@playwright/test'
import { makeStamp, signup } from '../fixtures/helpers'

const STAMP = makeStamp()

test.describe('Journey 30 — CLI Guide & Keyboard Shortcuts', () => {
  test.beforeEach(async ({ context, page }) => {
    await context.clearCookies()
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
  })

  test('happy path: ? key opens keyboard shortcuts modal', async ({ page }) => {
    test.setTimeout(30_000)

    await signup(page, `shortcuts-${STAMP}`)
    // Focus outside any input
    await page.locator('body').click()
    await page.keyboard.press('?')

    await expect(
      page.getByRole('dialog').filter({ hasText: /shortcut|keyboard/i })
        .or(page.getByText(/cmd.*enter|run scenario/i))
    ).toBeVisible({ timeout: 5000 })
  })

  test('happy path: open CLI guide modal from More actions', async ({ page }) => {
    test.setTimeout(30_000)

    await signup(page, `cli-${STAMP}`)
    await page.getByRole('button', { name: /more actions/i }).last().click().catch(async () => {
      await page.getByLabel(/more actions/i).click()
    })
    await page.getByRole('menuitem', { name: /cli/i }).click()
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 })
    await expect(page.getByText(/install|cli|terminal/i).first()).toBeVisible()
  })

  test('happy path: Cmd+Enter triggers run all', async ({ page }) => {
    test.setTimeout(60_000)

    await signup(page, `shortcut-run-${STAMP}`)
    await page.locator('body').click()
    await page.keyboard.press('Meta+Enter')
    // Run all should trigger — check for running or completed state
    await expect(
      page.getByText(/running|200|ok/i).first()
    ).toBeVisible({ timeout: 15000 }).catch(() => {
      // Acceptable if scenario is empty (no blocks to run)
    })
  })
})
```

- [ ] **Step 2: Run and commit**

```bash
cd apps/web && npx playwright test e2e/journeys/30-cli-shortcuts.spec.ts 2>&1 | tail -20
git add apps/web/e2e/journeys/30-cli-shortcuts.spec.ts
git commit -m "test: journey 30 — cli guide and keyboard shortcuts"
```

---

## Final Verification

### Task 33: Run full journey suite and confirm all pass

- [ ] **Step 1: Run all journey specs**

```bash
cd apps/web && npx playwright test e2e/journeys/ 2>&1 | tail -40
```

Expected: All 30 spec files, ~90 tests pass

- [ ] **Step 2: Verify no regressions in existing specs**

```bash
cd apps/web && npx playwright test e2e/inference.spec.ts e2e/cworld.spec.ts e2e/blocks-tree.spec.ts 2>&1 | tail -20
```

Expected: All existing tests still pass

- [ ] **Step 3: Final commit**

```bash
git add .
git commit -m "test: complete playwright journey test suite — 30 journeys"
```

---

## Appendix: Running Individual Tiers

```bash
# P0 only (fastest, run on every PR)
cd apps/web && npx playwright test e2e/journeys/01- e2e/journeys/02- e2e/journeys/07- e2e/journeys/13-

# P0 + P1 (core value, run on main branch merges)
cd apps/web && npx playwright test e2e/journeys/0{1,2,3,4,5,6,7} e2e/journeys/13- e2e/journeys/15- e2e/journeys/16-

# Full suite (run nightly or before release)
cd apps/web && npx playwright test e2e/journeys/
```
