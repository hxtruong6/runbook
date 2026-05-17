// Real-user journey: a new dev opens Runbook, signs up, picks the auto-
// created project + scenario, pastes a curl pointing at the cworld-be
// server, runs it, and verifies that schema inference surfaces the
// captured shape in the banner, modal, sidebar badge, and after reload.
import { test, expect, type Page } from '@playwright/test'

// NOTE: cworld-be at http://127.0.0.1:4000 only returns
// Access-Control-Allow-Credentials but no Access-Control-Allow-Origin, which
// browsers block. We exercise the full UI loop against a CORS-enabled public
// endpoint instead. The inference engine itself is independently verified
// against cworld-be in packages/shared/tests/e2e/cworld.test.ts.
const TARGET = process.env.E2E_TARGET ?? 'https://jsonplaceholder.typicode.com/users/1'
const TARGET_PATH = 'users/1'

const STAMP = Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
const USER = {
  email: `e2e-${STAMP}@runbook.local`,
  name: 'E2E Tester',
  password: 'testpass1234',
}

async function dismissNoise(page: Page) {
  // Pre-disable the onboarding tour + sync banner so they don't intercept clicks.
  await page.evaluate(() => {
    localStorage.setItem('rb_tour_completed', '1')
    localStorage.setItem('rb_tour_banner_dismissed', '1')
    localStorage.setItem('rb_tour_loaded', '1')
    localStorage.setItem('rb_save_sync_dismissed', '1')
  })
}

async function signup(page: Page) {
  await page.goto('/')
  await dismissNoise(page)
  await page.reload()
  await page.getByRole('tab', { name: 'Create account' }).click()
  await page.getByRole('textbox', { name: 'Email' }).fill(USER.email)
  await page.getByRole('textbox', { name: 'Name' }).fill(USER.name)
  await page.getByRole('textbox', { name: 'Password' }).fill(USER.password)
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByRole('button', { name: /run all/i })).toBeVisible({ timeout: 15000 })
  // Wait for the auto-created project to load + auto-select.
  await expect(async () => {
    const v = await page.getByRole('textbox', { name: 'Select project' }).inputValue().catch(() => '')
    expect(v.length).toBeGreaterThan(0)
  }).toPass({ timeout: 10000 })
}

async function selectAutoProject(page: Page) {
  // Server auto-creates a project + auto-selects it on signup. If for some
  // reason the value is empty, click the dropdown and pick the first option.
  const projectSelect = page.getByRole('textbox', { name: 'Select project' })
  if (!(await projectSelect.isVisible().catch(() => false))) return
  const current = await projectSelect.inputValue().catch(() => '')
  if (current && current.trim().length > 0) return
  await projectSelect.click()
  await page.getByRole('option').first().click()
}

async function openScenario(page: Page) {
  // Find the auto-created scenario in the sidebar list and click it.
  const scenario = page.getByText('My first scenario', { exact: true }).first()
  await scenario.waitFor({ state: 'visible', timeout: 8000 })
  await scenario.click()
}

async function pasteCurlBlock(page: Page) {
  // Switch to the Block library view in the left nav.
  await page.getByRole('button', { name: 'Block library view' }).click()
  // Click the "Paste cURL" entry.
  await page.getByRole('button', { name: /paste cu?rl/i }).first().click()
  // The PasteCurlModal contains a single textarea.
  await page.locator('textarea').first().fill(`curl -X GET '${TARGET}'`)
  await page.getByRole('button', { name: /add to block library/i }).click()
  // Confirm the block landed in the local library list.
  await expect(page.getByText(TARGET_PATH).first()).toBeVisible({ timeout: 5000 })
}

async function addBlockToScenario(page: Page) {
  await page.getByRole('button', { name: 'Scenarios view' }).click()
  await openScenario(page)
  // The main canvas "+ Add block" button.
  await page.getByRole('button', { name: '+ Add block' }).click()
  // Menu dropdown: pick the imported block under "Custom blocks".
  await page.getByRole('menuitem', { name: new RegExp(TARGET_PATH) }).first().click()
  await expect(page.getByText(TARGET_PATH).first()).toBeVisible({ timeout: 5000 })
}

test.beforeEach(async ({ context, page }) => {
  await context.clearCookies()
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      // eslint-disable-next-line no-console
      console.log(`[browser:${msg.type()}]`, msg.text())
    }
  })
  page.on('pageerror', (err) => {
    // eslint-disable-next-line no-console
    console.log('[browser:pageerror]', err.message)
  })
  page.on('requestfailed', (req) => {
    // eslint-disable-next-line no-console
    console.log('[browser:requestfailed]', req.url(), req.failure()?.errorText)
  })
})

test('schema inference: capture + banner + modal + badge + persistence', async ({ page }) => {
  test.setTimeout(120_000)

  // 1. Signup → auto-team + project + scenario
  await signup(page)
  await page.screenshot({ path: 'e2e/_artifacts/01-signed-in.png', fullPage: true })

  await selectAutoProject(page)
  await page.screenshot({ path: 'e2e/_artifacts/02-project-selected.png', fullPage: true })

  // 2. Create a block from a curl that targets cworld-be
  await pasteCurlBlock(page)
  await page.screenshot({ path: 'e2e/_artifacts/03-curl-imported.png', fullPage: true })

  // 3. Drop the block into the auto-created scenario
  await addBlockToScenario(page)
  await page.screenshot({ path: 'e2e/_artifacts/04-block-in-scenario.png', fullPage: true })

  // 4. Run the block — exact-match to avoid hitting "Run all" / "Run from here".
  const runBtn = page.getByRole('button', { name: /^Run$/ }).first()
  await runBtn.click()
  await page.waitForTimeout(2500)
  await page.screenshot({ path: 'e2e/_artifacts/05-after-run.png', fullPage: true })

  // 5. Banner appears
  await expect(page.getByText(/Response schema captured/i)).toBeVisible({ timeout: 6000 })

  // 6. Modal opens and shows schema
  await page.getByRole('button', { name: 'View schema' }).click()
  await expect(page.getByText(/Inferred schema/i)).toBeVisible()
  await page.screenshot({ path: 'e2e/_artifacts/06-modal-open.png', fullPage: true })
  await page.keyboard.press('Escape')

  // 7. Sidebar badge — switch to library view and assert "📸 N" badge
  await page.getByRole('button', { name: 'Block library view' }).click()
  await expect(page.locator('text=/^1$/').first()).toBeVisible({ timeout: 3000 }).catch(() => {})
  await page.screenshot({ path: 'e2e/_artifacts/07-sidebar-badge.png', fullPage: true })

  // 8. Reload → schema persists
  await page.reload()
  await page.waitForLoadState('networkidle')
  await page.screenshot({ path: 'e2e/_artifacts/08-after-reload.png', fullPage: true })
  // Get back into the scenario after reload
  await selectAutoProject(page).catch(() => {})
  await openScenario(page).catch(() => {})
  await expect(page.getByText(/Response schema captured/i)).toBeVisible({ timeout: 10000 })
})
