# Journey Tests + Bug Fixes + UX Improvements

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Write 7 reusable Playwright journey tests to `apps/web/e2e/journeys/`, fix 5 confirmed bugs, and make 5 targeted UX improvements found during real-user exploration.

**Architecture:** Journey tests use shared helpers and a fresh account per test to avoid state leakage. Bug fixes are surgical edits to single components. UX improvements are small copy/label/affordance changes — no new components.

**Tech Stack:** Playwright (already installed), React + Mantine v7, TypeScript

**Servers required to run e2e tests:**
- Runbook web: `http://localhost:3005` (set via `E2E_WEB_URL=http://localhost:3005`)
- Runbook server: `http://localhost:3001`
- cworld-be: `http://127.0.0.1:4000`

**Run command:**
```bash
cd apps/web && E2E_WEB_URL=http://localhost:3005 pnpm exec playwright test e2e/journeys/ --headed --project=chromium
```

---

## Part A — Journey Tests

### Task A1: Shared journey helpers

**Files:**
- Create: `apps/web/e2e/journeys/helpers.ts`

- [ ] **Step 1: Create the helpers file**

```typescript
// apps/web/e2e/journeys/helpers.ts
import type { Page } from '@playwright/test'

export function makeUser() {
  const stamp = Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
  return {
    email: `journey-${stamp}@runbook.local`,
    name: 'Journey Tester',
    password: 'testpass1234',
  }
}

export async function dismissNoise(page: Page) {
  await page.evaluate(() => {
    localStorage.setItem('rb_tour_completed', '1')
    localStorage.setItem('rb_tour_banner_dismissed', '1')
    localStorage.setItem('rb_tour_loaded', '1')
    localStorage.setItem('rb_save_sync_dismissed', '1')
  })
}

export async function signUp(page: Page, user: ReturnType<typeof makeUser>) {
  await page.goto('/')
  await dismissNoise(page)
  await page.reload()
  await page.getByRole('tab', { name: 'Create account' }).click()
  await page.getByRole('textbox', { name: 'Email' }).fill(user.email)
  await page.getByRole('textbox', { name: 'Name' }).fill(user.name)
  await page.getByRole('textbox', { name: 'Password' }).fill(user.password)
  await page.getByRole('button', { name: 'Create account' }).click()
  // Wait for workspace to load
  await page.getByRole('button', { name: /run all/i }).waitFor({ timeout: 15_000 })
}

export async function signIn(page: Page, user: ReturnType<typeof makeUser>) {
  await page.goto('/')
  await dismissNoise(page)
  await page.reload()
  await page.getByRole('textbox', { name: 'Email' }).fill(user.email)
  await page.getByRole('textbox', { name: 'Password' }).fill(user.password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.getByRole('button', { name: /run all/i }).waitFor({ timeout: 15_000 })
}

export async function waitForProject(page: Page) {
  // Wait for the project selector to show a project name (not empty)
  await page.waitForFunction(
    () => {
      const el = document.querySelector('input[aria-label="Select project"], input[placeholder="Select project"]') as HTMLInputElement | null
      return el && el.value.length > 0
    },
    { timeout: 10_000 }
  )
}
```

- [ ] **Step 2: Verify the file exists**

```bash
ls apps/web/e2e/journeys/helpers.ts
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/e2e/journeys/helpers.ts
git commit -m "test: add shared helpers for journey tests"
```

---

### Task A2: Journey 1 — Sign-up and sign-in

**Files:**
- Create: `apps/web/e2e/journeys/01-auth.spec.ts`

- [ ] **Step 1: Write the test**

```typescript
// apps/web/e2e/journeys/01-auth.spec.ts
// Journey: new user signs up, logs out, logs back in.
// Prereqs: Runbook web on :3005, server on :3001
import { test, expect } from '@playwright/test'
import { makeUser, signUp, signIn } from './helpers'

test.describe('Auth journey', () => {
  test('sign up creates a workspace', async ({ context, page }) => {
    test.setTimeout(30_000)
    await context.clearCookies()
    await page.evaluate(() => localStorage.clear()).catch(() => {})

    const user = makeUser()
    await signUp(page, user)

    // Workspace loaded — Run All button is visible
    await expect(page.getByRole('button', { name: /run all/i })).toBeVisible()
    await page.screenshot({ path: 'e2e/_artifacts/journey-01-signed-up.png' })
  })

  test('sign out then sign in reaches workspace', async ({ context, page }) => {
    test.setTimeout(30_000)
    await context.clearCookies()
    await page.evaluate(() => localStorage.clear()).catch(() => {})

    const user = makeUser()
    await signUp(page, user)

    // Sign out via user menu
    await page.getByRole('button', { name: /user menu|account|@/i }).first().click().catch(async () => {
      // fallback: find any button containing the user email substring
      await page.locator(`button:has-text("${user.email.slice(0, 6)}")`).click()
    })
    await page.getByRole('menuitem', { name: /log out|sign out/i }).click()

    // Should be back at login page
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible({ timeout: 10_000 })

    // Sign back in
    await signIn(page, user)
    await expect(page.getByRole('button', { name: /run all/i })).toBeVisible()
    await page.screenshot({ path: 'e2e/_artifacts/journey-01-signed-in-again.png' })
  })
})
```

- [ ] **Step 2: Run to verify it passes**

```bash
cd apps/web && E2E_WEB_URL=http://localhost:3005 pnpm exec playwright test e2e/journeys/01-auth.spec.ts --headed --project=chromium 2>&1 | tail -20
```
Expected: 2 tests pass

- [ ] **Step 3: Commit**

```bash
git add apps/web/e2e/journeys/01-auth.spec.ts
git commit -m "test(journey): auth sign-up and sign-in flow"
```

---

### Task A3: Journey 2 — Project creation

**Files:**
- Create: `apps/web/e2e/journeys/02-project.spec.ts`

- [ ] **Step 1: Write the test**

```typescript
// apps/web/e2e/journeys/02-project.spec.ts
// Journey: create a new named project, verify it becomes active.
import { test, expect } from '@playwright/test'
import { makeUser, signUp, waitForProject } from './helpers'

test('create project becomes active', async ({ context, page }) => {
  test.setTimeout(30_000)
  await context.clearCookies()
  await page.evaluate(() => localStorage.clear()).catch(() => {})

  const user = makeUser()
  await signUp(page, user)
  await waitForProject(page)

  // Open "New project" modal
  await page.getByRole('button', { name: '+ New' }).click()

  // Fill name and submit
  const projectName = `cworld-${Date.now().toString(36)}`
  await page.getByRole('textbox', { name: /project name/i }).fill(projectName)
  await page.getByRole('button', { name: 'Create' }).click()

  // New project should become active in the selector
  await expect(async () => {
    const val = await page.locator('input[placeholder*="project" i]').first().inputValue()
    expect(val).toBe(projectName)
  }).toPass({ timeout: 10_000 })

  await page.screenshot({ path: 'e2e/_artifacts/journey-02-project-created.png' })
})
```

- [ ] **Step 2: Run to verify it passes**

```bash
cd apps/web && E2E_WEB_URL=http://localhost:3005 pnpm exec playwright test e2e/journeys/02-project.spec.ts --headed --project=chromium 2>&1 | tail -20
```
Expected: 1 test passes

- [ ] **Step 3: Commit**

```bash
git add apps/web/e2e/journeys/02-project.spec.ts
git commit -m "test(journey): project creation flow"
```

---

### Task A4: Journey 3 — Environment setup

**Files:**
- Create: `apps/web/e2e/journeys/03-environment.spec.ts`

- [ ] **Step 1: Write the test**

```typescript
// apps/web/e2e/journeys/03-environment.spec.ts
// Journey: open the environment manager, create an env with a base URL,
// verify it appears in the env switcher.
import { test, expect } from '@playwright/test'
import { makeUser, signUp, waitForProject } from './helpers'

test('create environment with base URL', async ({ context, page }) => {
  test.setTimeout(30_000)
  await context.clearCookies()
  await page.evaluate(() => localStorage.clear()).catch(() => {})

  const user = makeUser()
  await signUp(page, user)
  await waitForProject(page)

  // Open env editor via gear icon (aria-label="Manage environments")
  await page.getByRole('button', { name: 'Manage environments' }).click()

  // Env editor modal opens
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 })

  // Click "New environment" button inside the modal
  await page.getByRole('button', { name: 'New environment' }).first().click()

  // Fill name and base URL
  await page.getByRole('textbox', { name: 'Name' }).fill('Local')
  await page.getByRole('textbox', { name: 'Base URL' }).fill('http://127.0.0.1:4000')

  // Save
  await page.getByRole('button', { name: 'Save' }).click()

  // Close modal
  await page.keyboard.press('Escape')

  // Env switcher now shows "Local"
  await expect(async () => {
    const val = await page.locator('input[placeholder="No environment"]').first().inputValue()
    expect(val).toBe('Local')
  }).toPass({ timeout: 5_000 })

  await page.screenshot({ path: 'e2e/_artifacts/journey-03-env-created.png' })
})
```

- [ ] **Step 2: Run to verify it passes**

```bash
cd apps/web && E2E_WEB_URL=http://localhost:3005 pnpm exec playwright test e2e/journeys/03-environment.spec.ts --headed --project=chromium 2>&1 | tail -20
```
Expected: 1 test passes

- [ ] **Step 3: Commit**

```bash
git add apps/web/e2e/journeys/03-environment.spec.ts
git commit -m "test(journey): environment setup flow"
```

---

### Task A5: Journey 4 — Paste cURL and add block

**Files:**
- Create: `apps/web/e2e/journeys/04-paste-curl.spec.ts`

- [ ] **Step 1: Write the test**

```typescript
// apps/web/e2e/journeys/04-paste-curl.spec.ts
// Journey: paste a curl command for the cworld-be health endpoint,
// verify the live preview parses it, then add it to the block library.
// Prereq: cworld-be running on :4000 (only used for the URL string, not called here)
import { test, expect } from '@playwright/test'
import { makeUser, signUp, waitForProject } from './helpers'

const HEALTH_CURL = `curl -X GET 'http://127.0.0.1:4000/api/health'`

test('paste cURL adds block to library', async ({ context, page }) => {
  test.setTimeout(30_000)
  await context.clearCookies()
  await page.evaluate(() => localStorage.clear()).catch(() => {})

  const user = makeUser()
  await signUp(page, user)
  await waitForProject(page)

  // Open "Add block" menu in block library sidebar
  await page.getByRole('button', { name: 'Add block' }).click()
  await page.getByRole('menuitem', { name: /paste curl/i }).click()

  // Paste cURL modal opens
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('textbox').fill(HEALTH_CURL)

  // Live preview should show the parsed method + path
  await expect(page.getByText(/GET/)).toBeVisible({ timeout: 3_000 })
  await expect(page.getByText(/api\/health/i)).toBeVisible()

  await page.screenshot({ path: 'e2e/_artifacts/journey-04-curl-preview.png' })

  // Add to library
  await page.getByRole('button', { name: /add to block library/i }).click()

  // Toast: "Block '...' added to your library"
  await expect(page.getByText(/added to your library/i)).toBeVisible({ timeout: 5_000 })

  // Block appears in library
  await expect(page.getByText(/api\/health/i).first()).toBeVisible()

  await page.screenshot({ path: 'e2e/_artifacts/journey-04-block-added.png' })
})
```

- [ ] **Step 2: Run to verify it passes**

```bash
cd apps/web && E2E_WEB_URL=http://localhost:3005 pnpm exec playwright test e2e/journeys/04-paste-curl.spec.ts --headed --project=chromium 2>&1 | tail -20
```
Expected: 1 test passes

- [ ] **Step 3: Commit**

```bash
git add apps/web/e2e/journeys/04-paste-curl.spec.ts
git commit -m "test(journey): paste-curl block creation flow"
```

---

### Task A6: Journey 5 — Build and run a scenario

**Files:**
- Create: `apps/web/e2e/journeys/05-scenario-run.spec.ts`

- [ ] **Step 1: Write the test**

```typescript
// apps/web/e2e/journeys/05-scenario-run.spec.ts
// Journey: add a health-check block to a scenario, run it against
// cworld-be, verify 200 response appears in the result panel.
// Prereq: cworld-be running on :4000 (will actually be called)
import { test, expect } from '@playwright/test'
import { makeUser, signUp, waitForProject } from './helpers'

const HEALTH_CURL = `curl -X GET 'http://127.0.0.1:4000/api/health'`

test('run scenario produces 200 response', async ({ context, page }) => {
  test.setTimeout(60_000)
  await context.clearCookies()
  await page.evaluate(() => localStorage.clear()).catch(() => {})

  const user = makeUser()
  await signUp(page, user)
  await waitForProject(page)

  // Add block via paste-cURL
  await page.getByRole('button', { name: 'Add block' }).click()
  await page.getByRole('menuitem', { name: /paste curl/i }).click()
  await page.getByRole('textbox').fill(HEALTH_CURL)
  await page.getByRole('button', { name: /add to block library/i }).click()
  await expect(page.getByText(/added to your library/i)).toBeVisible({ timeout: 5_000 })

  // Create a scenario
  await page.getByRole('button', { name: 'New scenario' }).click()

  // Add the health block to the scenario
  await page.getByRole('button', { name: /add block/i }).last().click()
  await page.getByRole('option', { name: /api\/health/i }).first().click().catch(async () => {
    // Fallback: click any menu item containing "health"
    await page.locator('[role="menuitem"]:has-text("health")').first().click()
  })

  // Verify block appears in scenario
  await expect(page.getByText(/api\/health/i).first()).toBeVisible({ timeout: 5_000 })

  // Run the scenario
  await page.getByRole('button', { name: /run all/i }).click()

  // Result: status badge "ok" or HTTP 200
  await expect(
    page.getByText(/200|status.*ok|ok.*status/i).first()
  ).toBeVisible({ timeout: 15_000 })

  await page.screenshot({ path: 'e2e/_artifacts/journey-05-scenario-run.png' })
})
```

- [ ] **Step 2: Run to verify it passes**

```bash
cd apps/web && E2E_WEB_URL=http://localhost:3005 pnpm exec playwright test e2e/journeys/05-scenario-run.spec.ts --headed --project=chromium 2>&1 | tail -20
```
Expected: 1 test passes

- [ ] **Step 3: Commit**

```bash
git add apps/web/e2e/journeys/05-scenario-run.spec.ts
git commit -m "test(journey): scenario build and run flow"
```

---

### Task A7: Journey 6 — Schema inference

**Files:**
- Create: `apps/web/e2e/journeys/06-schema-inference.spec.ts`

- [ ] **Step 1: Write the test**

```typescript
// apps/web/e2e/journeys/06-schema-inference.spec.ts
// Journey: after running a block, the inference banner appears and
// "View schema" opens a modal with the inferred JSON schema.
// Prereq: cworld-be running on :4000
import { test, expect } from '@playwright/test'
import { makeUser, signUp, waitForProject } from './helpers'

const HEALTH_CURL = `curl -X GET 'http://127.0.0.1:4000/api/health'`

test('schema inference modal shows after run', async ({ context, page }) => {
  test.setTimeout(60_000)
  await context.clearCookies()
  await page.evaluate(() => localStorage.clear()).catch(() => {})

  const user = makeUser()
  await signUp(page, user)
  await waitForProject(page)

  // Add block and run scenario (reuse pattern from journey 5)
  await page.getByRole('button', { name: 'Add block' }).click()
  await page.getByRole('menuitem', { name: /paste curl/i }).click()
  await page.getByRole('textbox').fill(HEALTH_CURL)
  await page.getByRole('button', { name: /add to block library/i }).click()
  await expect(page.getByText(/added to your library/i)).toBeVisible({ timeout: 5_000 })

  await page.getByRole('button', { name: 'New scenario' }).click()
  await page.getByRole('button', { name: /add block/i }).last().click()
  await page.locator('[role="menuitem"]:has-text("health")').first().click()
  await page.getByRole('button', { name: /run all/i }).click()
  await expect(page.getByText(/200|ok/i).first()).toBeVisible({ timeout: 15_000 })

  // Inference banner appears
  await expect(page.getByText(/schema captured|response schema/i)).toBeVisible({ timeout: 5_000 })

  // Open schema modal
  await page.getByRole('button', { name: /view schema/i }).click()
  await expect(page.getByRole('dialog')).toBeVisible()

  // Modal contains "status" from the inferred schema
  await expect(page.getByText(/status/i).first()).toBeVisible()

  await page.screenshot({ path: 'e2e/_artifacts/journey-06-schema-modal.png' })

  await page.keyboard.press('Escape')
})
```

- [ ] **Step 2: Run to verify it passes**

```bash
cd apps/web && E2E_WEB_URL=http://localhost:3005 pnpm exec playwright test e2e/journeys/06-schema-inference.spec.ts --headed --project=chromium 2>&1 | tail -20
```
Expected: 1 test passes

- [ ] **Step 3: Commit**

```bash
git add apps/web/e2e/journeys/06-schema-inference.spec.ts
git commit -m "test(journey): schema inference after run"
```

---

### Task A8: Journey 7 — Context variable chaining

**Files:**
- Create: `apps/web/e2e/journeys/07-context-chaining.spec.ts`

- [ ] **Step 1: Write the test**

```typescript
// apps/web/e2e/journeys/07-context-chaining.spec.ts
// Journey: after running a block, the context panel shows the captured
// variables (e.g. lastStatus). Verifies the data-flow chain mechanism.
// Prereq: cworld-be running on :4000
import { test, expect } from '@playwright/test'
import { makeUser, signUp, waitForProject } from './helpers'

const HEALTH_CURL = `curl -X GET 'http://127.0.0.1:4000/api/health'`

test('run captures context variables in panel', async ({ context, page }) => {
  test.setTimeout(60_000)
  await context.clearCookies()
  await page.evaluate(() => localStorage.clear()).catch(() => {})

  const user = makeUser()
  await signUp(page, user)
  await waitForProject(page)

  // Add health block and run
  await page.getByRole('button', { name: 'Add block' }).click()
  await page.getByRole('menuitem', { name: /paste curl/i }).click()
  await page.getByRole('textbox').fill(HEALTH_CURL)
  await page.getByRole('button', { name: /add to block library/i }).click()
  await expect(page.getByText(/added to your library/i)).toBeVisible({ timeout: 5_000 })

  await page.getByRole('button', { name: 'New scenario' }).click()
  await page.getByRole('button', { name: /add block/i }).last().click()
  await page.locator('[role="menuitem"]:has-text("health")').first().click()
  await page.getByRole('button', { name: /run all/i }).click()
  await expect(page.getByText(/200|ok/i).first()).toBeVisible({ timeout: 15_000 })

  // Context panel (right side) should show lastStatus = ok
  // The panel is the "Context" tab on the right
  await page.getByRole('tab', { name: /context/i }).first().click().catch(() => {})
  await expect(page.getByText('lastStatus')).toBeVisible({ timeout: 5_000 })

  await page.screenshot({ path: 'e2e/_artifacts/journey-07-context-vars.png' })
})
```

- [ ] **Step 2: Run to verify it passes**

```bash
cd apps/web && E2E_WEB_URL=http://localhost:3005 pnpm exec playwright test e2e/journeys/07-context-chaining.spec.ts --headed --project=chromium 2>&1 | tail -20
```
Expected: 1 test passes

- [ ] **Step 3: Commit**

```bash
git add apps/web/e2e/journeys/07-context-chaining.spec.ts
git commit -m "test(journey): context variable capture after run"
```

---

## Part B — Bug Fixes

### Task B1: Graph nodes show `kind` instead of human-readable label

**Root cause:** `App.tsx:317` assigns `name: b.kind` when building the initial `GraphData`. `b.kind` is the internal slug (e.g. `get-api-health`). The block's display label (e.g. `GET api/health`) lives in `registry[b.kind]?.label`.

**Files:**
- Modify: `apps/web/src/App.tsx` (function `enableGraphMode`, line ~307)

- [ ] **Step 1: Fix `enableGraphMode` to use the registry label**

Find this block in `App.tsx` (around line 314):
```typescript
    const initialGraphData: GraphData = {
      startNodeId: startId,
      nodes: scenario.blocks.map((b, i) => ({
        blockInstance: b,
        name: b.kind,
        position: { x: 200, y: 80 + i * 120 },
      })).concat([{
```

Replace with:
```typescript
    const initialGraphData: GraphData = {
      startNodeId: startId,
      nodes: scenario.blocks.map((b, i) => ({
        blockInstance: b,
        name: registry[b.kind]?.label ?? b.kind,
        position: { x: 200, y: 80 + i * 120 },
      })).concat([{
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd apps/web && pnpm exec tsc --noEmit 2>&1 | grep -E "error|warning" | head -20
```
Expected: no new errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/App.tsx
git commit -m "fix: graph nodes display block label instead of internal kind slug"
```

---

### Task B2: Duplicate aria-labels on scenario sidebar and block rows

**Root cause:** All scenario sidebar rows use the generic `aria-label="Scenario options"`. This means multiple elements have the same label, breaking accessibility tools that expect aria-labels to identify unique controls. Fix: make each label scenario-specific.

**Files:**
- Modify: `apps/web/src/App.tsx` (around line 565)

- [ ] **Step 1: Make the scenario options aria-label scenario-specific**

Find (around line 562):
```tsx
                                <ActionIcon
                                  size="xs"
                                  variant="subtle"
                                  aria-label="Scenario options"
                                  onClick={(e) => e.stopPropagation()}
                                >
```

Replace with:
```tsx
                                <ActionIcon
                                  size="xs"
                                  variant="subtle"
                                  aria-label={`${s.name || 'Scenario'} options`}
                                  onClick={(e) => e.stopPropagation()}
                                >
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd apps/web && pnpm exec tsc --noEmit 2>&1 | grep error | head -10
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/App.tsx
git commit -m "fix: make scenario sidebar options aria-label unique per scenario"
```

---

### Task B3: Run count badge has no tooltip

**Root cause:** `BlockCard.tsx:257` shows a `<ActionIcon aria-label="Block actions">` with no description of what the run count badge means. Users see a number badge with no explanation.

Note: The run count badge appears to be a count displayed on the block card. Let's locate it and add a Tooltip.

**Files:**
- Modify: `apps/web/src/components/BlockCard.tsx`

- [ ] **Step 1: Find the run count badge and add a Tooltip**

First, look at lines around 200-260 in `BlockCard.tsx` to find the badge that shows run count.

```bash
grep -n "Badge\|runCount\|count\|runs\|Tooltip" apps/web/src/components/BlockCard.tsx | head -30
```

Once you find the badge element that shows a number count, wrap it in a `<Tooltip label="Total runs" withArrow position="top">...</Tooltip>`. Import `Tooltip` from `@mantine/core` if not already imported.

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd apps/web && pnpm exec tsc --noEmit 2>&1 | grep error | head -10
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/BlockCard.tsx
git commit -m "fix: add tooltip to block run count badge"
```

---

### Task B4: `socketSessionUuid` visually treated as user-editable context

**Root cause:** `ContextStore.tsx` seeds `socketSessionUuid` as a regular key. The context panel shows it with an edit+delete UI, but deleting it causes it to reappear (it's regenerated on next interaction). This misleads users into thinking they can remove it.

**Files:**
- Modify: `apps/web/src/components/ContextPanel.tsx`

- [ ] **Step 1: Find the system key display in ContextPanel**

```bash
grep -n "socketSessionUuid\|system.*key\|SYSTEM\|immutable" apps/web/src/components/ContextPanel.tsx | head -10
```

- [ ] **Step 2: Visually dim system keys and hide their delete button**

In `ContextPanel.tsx`, find where context key rows are rendered. System keys (those starting with `socket`) should:
- Show a `(system)` text in dimmed color next to the key name
- Hide the delete button

Find the `EntryRow` component (around line 115) and add this logic:

```typescript
const isSystemKey = contextKey === 'socketSessionUuid' || contextKey.startsWith('socket')

// In the render of EntryRow, change the delete button to:
{!isSystemKey && (
  <ActionIcon
    size="xs"
    variant="subtle"
    color="red"
    onClick={onDelete}
    aria-label={`Delete ${contextKey}`}
  >
    <IconTrash size={12} />
  </ActionIcon>
)}
// And add after the key name Text:
{isSystemKey && (
  <Text size="10px" c="dimmed" component="span"> (system)</Text>
)}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd apps/web && pnpm exec tsc --noEmit 2>&1 | grep error | head -10
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/ContextPanel.tsx
git commit -m "fix: mark socketSessionUuid as system key in context panel"
```

---

### Task B5: Sidebar empty-state text may truncate

**Root cause:** The helper text `"Create a scenario or load a sample bundle to get started."` is set on an `EmptyState` component inside the sidebar's narrow (240px) column. It should wrap, not truncate.

**Files:**
- Modify: `apps/web/src/App.tsx` (around line 527)

- [ ] **Step 1: Check the exact text**

```bash
grep -n "Create a scenario\|load a sample" apps/web/src/App.tsx
```

- [ ] **Step 2: Verify the `EmptyState` component accepts `style` for text wrapping**

```bash
grep -n "helper\|Text.*lineClamp\|truncate\|wrap" apps/web/src/components/EmptyState.tsx | head -10
```

- [ ] **Step 3: If text is truncating, fix it**

If `EmptyState.tsx` uses `lineClamp` or `truncate` on the helper text, remove it. The sidebar is narrow but the text should wrap, not truncate.

Find in `EmptyState.tsx` the helper text element. If it has `lineClamp={1}` or `style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}`, change it to allow wrapping:

```tsx
<Text size="xs" c="dimmed" ta="center">
  {helper}
</Text>
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/EmptyState.tsx
git commit -m "fix: allow sidebar empty-state helper text to wrap"
```

---

## Part C — UX Improvements

### Task C1: Project rename

**Root cause:** The project "..." actions menu only has Publish and Delete. Rename is missing, forcing users to delete and recreate.

**Files:**
- Modify: `apps/web/src/components/ProjectSwitcher.tsx`

- [ ] **Step 1: Add `renameProject` from the store (check if it exists)**

```bash
grep -n "rename\|updateProject\|patchProject" apps/web/src/projects/projectsStore.ts | head -10
```

If `renameProject` doesn't exist in the store, check `updateProject` or similar.

- [ ] **Step 2: Add rename handler to ProjectSwitcher**

In `ProjectSwitcher.tsx`, add a `handleRename` function after `handleDelete`:

```typescript
function handleRename() {
  const project = projects.find((p) => p._id === activeProjectId)
  if (!project || !activeTeamId) return
  let name = project.name
  modals.open({
    title: 'Rename project',
    children: (
      <form
        onSubmit={async (e) => {
          e.preventDefault()
          const trimmed = name.trim()
          if (!trimmed || trimmed === project.name) { modals.closeAll(); return }
          try {
            await renameProject(activeTeamId, project._id, trimmed)
            modals.closeAll()
          } catch {
            notifications.show({ color: 'red', message: 'Failed to rename project' })
          }
        }}
      >
        <TextInput
          defaultValue={project.name}
          onChange={(ev) => { name = ev.currentTarget.value }}
          data-autofocus
          mb="sm"
        />
        <Button type="submit" size="sm" fullWidth>Rename</Button>
      </form>
    ),
  })
}
```

**Note:** If the store doesn't expose `renameProject`, check whether `updateProject` accepts a partial update. If neither exists, use a direct API call or skip this task and note it as requiring a backend endpoint.

- [ ] **Step 3: Add Rename menu item**

In the project "..." menu dropdown (around line 209), add before the divider:

```tsx
<Menu.Item
  leftSection={<IconPencil size={14} />}
  onClick={handleRename}
>
  Rename project…
</Menu.Item>
<Menu.Divider />
```

Also add `IconPencil` to the import from `@tabler/icons-react`.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd apps/web && pnpm exec tsc --noEmit 2>&1 | grep error | head -10
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/ProjectSwitcher.tsx
git commit -m "feat: add rename project option to project actions menu"
```

---

### Task C2: "Burst…" menu item needs a description

**Root cause:** Users see "Burst…" in the TopBar scenario menu with no indication of what it does. A subtitle under the menu item explains it.

**Files:**
- Modify: `apps/web/src/components/TopBar.tsx`

- [ ] **Step 1: Find the Burst menu item**

```bash
grep -n "Burst\|burst" apps/web/src/components/TopBar.tsx | head -10
```

- [ ] **Step 2: Add description to the Burst menu item**

Find the `Menu.Item` for Burst and change it to include a description. Mantine's `Menu.Item` supports a `description` prop:

```tsx
<Menu.Item
  leftSection={<IconBolt size={14} />}
  description="Run this scenario N times concurrently"
  onClick={onBurst}
>
  Burst…
</Menu.Item>
```

If Mantine's `Menu.Item` in this version doesn't support `description`, use a two-line layout:

```tsx
<Menu.Item onClick={onBurst}>
  <Stack gap={0}>
    <Text size="sm">Burst…</Text>
    <Text size="xs" c="dimmed">Run N times concurrently</Text>
  </Stack>
</Menu.Item>
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd apps/web && pnpm exec tsc --noEmit 2>&1 | grep error | head -10
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/TopBar.tsx
git commit -m "ux: add description to Burst menu item"
```

---

### Task C3: "No environment" Select looks like a disabled input

**Root cause:** `EnvSwitcher.tsx` uses a Mantine `<Select placeholder="No environment">` which renders as a greyed placeholder — identical to a disabled field. Users don't realize it's clickable.

**Files:**
- Modify: `apps/web/src/components/EnvSwitcher.tsx`

- [ ] **Step 1: Add a visual hint that the environment selector is interactive**

When `state.activeId` is null (no environment selected), show a subtle "Set up" hint. Change the Select's `placeholder` and add a `rightSection` when empty:

```tsx
<Select
  size="xs"
  data={selectData}
  value={state.activeId ?? null}
  onChange={handleChange}
  placeholder="Set environment…"
  w={160}
  comboboxProps={{ withinPortal: true }}
  styles={{
    input: {
      fontWeight: 500,
      // When no value selected, use a slightly more prominent color
      color: state.activeId ? undefined : 'var(--mantine-color-violet-6)',
    }
  }}
/>
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd apps/web && pnpm exec tsc --noEmit 2>&1 | grep error | head -10
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/EnvSwitcher.tsx
git commit -m "ux: improve environment selector discoverability when no env is set"
```

---

### Task C4: Schema modal "Last example (redacted)" confusing label

**Root cause:** `InferenceModal.tsx:100` shows "Last example (redacted)" — the word "redacted" implies sensitive data was hidden, but the example is actually unmodified. The label misleads users.

**Files:**
- Modify: `apps/web/src/inference/InferenceModal.tsx`

- [ ] **Step 1: Fix the label**

```bash
grep -n "redacted" apps/web/src/inference/InferenceModal.tsx
```

Find the text "Last example (redacted)" and change it to "Last captured response":

```bash
# Read the exact line context first
sed -n '95,110p' apps/web/src/inference/InferenceModal.tsx
```

Then edit to replace `Last example (redacted)` with `Last captured response`.

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd apps/web && pnpm exec tsc --noEmit 2>&1 | grep error | head -10
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/inference/InferenceModal.tsx
git commit -m "ux: rename 'Last example (redacted)' to 'Last captured response'"
```

---

### Task C5: Add "Paste cURL" shortcut to "Add block" menu visibility audit

**Note:** This task is an audit. The "Paste cURL" option IS present in the Block Library's "Add block" menu (`BlockDefsPanel.tsx`). The audit checks whether it's visible enough for new users.

**Files:**
- Modify: `apps/web/src/components/BlockDefsPanel.tsx` (if needed)

- [ ] **Step 1: Read the current "Add block" menu**

```bash
sed -n '185,215p' apps/web/src/components/BlockDefsPanel.tsx
```

- [ ] **Step 2: Verify "Paste cURL command" is the second item (right after "New API block")**

Current order:
1. "New API block"
2. "Paste cURL command"
3. --- divider ---
4. "OpenAPI spec"

This is correct. No change needed if this order is already in place.

If the order differs, reorder so "Paste cURL command" comes immediately after "New API block" (it's the most common single-block creation path).

- [ ] **Step 3: Add a descriptive label to the menu section**

If the menu currently reads just "Create a block", improve it:

```tsx
<Menu.Label>Add a single block</Menu.Label>
<Menu.Item leftSection={<IconPlus size={14} />} onClick={handleAddNew}>
  New API block (blank form)
</Menu.Item>
<Menu.Item
  leftSection={<IconTerminal2 size={14} />}
  onClick={() => setPasteCurlOpen(true)}
>
  Paste cURL command
</Menu.Item>
```

- [ ] **Step 4: Commit (only if changes were made)**

```bash
git add apps/web/src/components/BlockDefsPanel.tsx
git commit -m "ux: clarify add-block menu labels for new users"
```

---

## Self-Review

### Spec coverage check

| Requirement | Task |
|---|---|
| 7 journey test files in `e2e/journeys/` | A1–A8 |
| Shared helpers (makeUser, signUp, signIn) | A1 |
| Graph node name shows label not kind | B1 |
| aria-labels unique per scenario | B2 |
| Run count badge tooltip | B3 |
| socketSessionUuid system key visual | B4 |
| Empty state text wraps | B5 |
| Project rename | C1 |
| Burst description | C2 |
| Environment selector discoverability | C3 |
| Schema modal "redacted" label | C4 |
| Add-block menu clarity | C5 |

### Placeholder check

- B3 Step 1 asks you to grep first — this is necessary because the badge location isn't confirmed to line-level detail without reading the full file
- C1 Step 1 asks you to check for `renameProject` — backend capability must be verified before writing the call
- These are the only "grep first" steps; all others have complete code

### Type consistency

- `registry[b.kind]?.label` — `registry` is typed as `Record<string, BlockDef>` and `BlockDef.label` is a `string`. This access is safe with optional chaining.
- `s.name` in the aria-label template — `Scenario.name` is `string`. Safe.
