// Real-user journey against the cworld-be backend at 127.0.0.1:4000.
// Pastes a curl pointing at /api/health (no auth required), runs it,
// and verifies the inference banner picks up the response schema.
//
// Prereqs:
//   - cworld-be running with CORS Allow-Origin set to http://localhost:3007
//   - Runbook server on :3001 and web on :3007
import { test, expect, type Page } from '@playwright/test'

const TARGET = 'http://127.0.0.1:4000/api/health'
const TARGET_PATH = 'api/health'

const STAMP = Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
const USER = {
  email: `cworld-${STAMP}@runbook.local`,
  name: 'cworld Tester',
  password: 'testpass1234',
}

async function dismissNoise(page: Page) {
  await page.evaluate(() => {
    localStorage.setItem('rb_tour_completed', '1')
    localStorage.setItem('rb_tour_banner_dismissed', '1')
    localStorage.setItem('rb_tour_loaded', '1')
    localStorage.setItem('rb_save_sync_dismissed', '1')
  })
}

test.beforeEach(async ({ context, page }) => {
  await context.clearCookies()
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  page.on('pageerror', (err) => {
    // eslint-disable-next-line no-console
    console.log('[browser:pageerror]', err.message)
  })
  page.on('requestfailed', (req) => {
    // eslint-disable-next-line no-console
    console.log('[browser:requestfailed]', req.url(), req.failure()?.errorText)
  })
})

test('cworld-be: import OpenAPI doc via URL', async ({ page }) => {
  test.setTimeout(60_000)

  await page.goto('/')
  await dismissNoise(page)
  await page.reload()
  await page.getByRole('tab', { name: 'Create account' }).click()
  await page.getByRole('textbox', { name: 'Email' }).fill(`oapi-${STAMP}@runbook.local`)
  await page.getByRole('textbox', { name: 'Name' }).fill('OpenAPI Tester')
  await page.getByRole('textbox', { name: 'Password' }).fill(USER.password)
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByRole('button', { name: /run all/i })).toBeVisible({ timeout: 15000 })
  await expect(async () => {
    const v = await page.getByRole('textbox', { name: 'Select project' }).inputValue().catch(() => '')
    expect(v.length).toBeGreaterThan(0)
  }).toPass({ timeout: 10000 })

  // Open the OpenAPI importer via the sidebar's Import dropdown — the
  // direct button was consolidated into a menu during the UX cleanup.
  await page.getByRole('button', { name: 'Import' }).first().click()
  await page.getByRole('menuitem', { name: /OpenAPI spec/i }).click()
  // Modal renders "Import from OpenAPI" title; the URL field has the
  // petstore placeholder.
  const urlBox = page.getByPlaceholder(/openapi\.json/i).first()
  await urlBox.fill('http://127.0.0.1:4000/documentation-json')
  await page.getByRole('button', { name: 'Load' }).click()

  // Preview pane must render the parsed operations — proves the
  // "Buffer is not defined" regression is fixed.
  await expect(page.getByText(/operations selected/i)).toBeVisible({ timeout: 20000 })
  await page.screenshot({ path: 'e2e/_artifacts/cworld-openapi-preview.png', fullPage: true })

  // The list has 127 operations across many tags — verify the LAST one is
  // reachable (catches "scroll area doesn't actually scroll" bugs where the
  // header renders but most items are clipped off-screen).
  const importBtn = page.getByRole('button', { name: /Import 127 operations/i })
  await expect(importBtn).toBeVisible()
  const checkboxes = page.getByRole('checkbox')
  const count = await checkboxes.count()
  expect(count).toBeGreaterThan(50)
  await checkboxes.nth(count - 1).scrollIntoViewIfNeeded()
  await expect(checkboxes.nth(count - 1)).toBeVisible()

  // Actually submit the import and verify the user sees state change. A
  // silent "Imported!" toast is NOT enough — the new project must become
  // active so the user lands on the imported scenarios. Pre-fix, the
  // active project never switched and the user felt the import did nothing.
  await importBtn.click()
  await expect(page.getByRole('textbox', { name: 'Select project' }))
    .not.toHaveValue('My first project', { timeout: 10000 })
})

test('cworld-be: import curl, run, capture schema', async ({ page }) => {
  test.setTimeout(60_000)

  // Signup → bootstrap workspace
  await page.goto('/')
  await dismissNoise(page)
  await page.reload()
  await page.getByRole('tab', { name: 'Create account' }).click()
  await page.getByRole('textbox', { name: 'Email' }).fill(USER.email)
  await page.getByRole('textbox', { name: 'Name' }).fill(USER.name)
  await page.getByRole('textbox', { name: 'Password' }).fill(USER.password)
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByRole('button', { name: /run all/i })).toBeVisible({ timeout: 15000 })
  await expect(async () => {
    const v = await page.getByRole('textbox', { name: 'Select project' }).inputValue().catch(() => '')
    expect(v.length).toBeGreaterThan(0)
  }).toPass({ timeout: 10000 })

  await page.screenshot({ path: 'e2e/_artifacts/cworld-01-signed-in.png', fullPage: true })

  // Paste curl pointing at cworld-be
  await page.getByRole('button', { name: 'Block library view' }).click()
  await page.getByRole('button', { name: /paste cu?rl/i }).first().click()
  await page.locator('textarea').first().fill(`curl -X GET '${TARGET}'`)
  await page.getByRole('button', { name: /add to block library/i }).click()
  await expect(page.getByText(TARGET_PATH).first()).toBeVisible({ timeout: 5000 })

  await page.screenshot({ path: 'e2e/_artifacts/cworld-02-imported.png', fullPage: true })

  // Drop into scenario
  await page.getByRole('button', { name: 'Scenarios view' }).click()
  await page.getByText('My first scenario', { exact: true }).first().click()
  await page.getByRole('button', { name: '+ Add block' }).click()
  const item = page.getByRole('menuitem', { name: new RegExp(TARGET_PATH) }).first()
  await item.scrollIntoViewIfNeeded()
  await item.click()
  await expect(page.getByText(TARGET_PATH).first()).toBeVisible({ timeout: 5000 })

  // Run
  await page.getByRole('button', { name: /^Run$/ }).first().click()
  await page.waitForTimeout(2500)
  await page.screenshot({ path: 'e2e/_artifacts/cworld-03-after-run.png', fullPage: true })

  // The cworld /api/health response is {details, error, info, status:"ok"}.
  // Inference should capture this shape.
  await expect(page.getByText(/Response schema captured/i)).toBeVisible({ timeout: 8000 })
  await expect(page.getByText(/"status"/)).toBeVisible({ timeout: 5000 })

  // Open schema modal and verify it shows the inferred shape.
  await page.getByRole('button', { name: 'View schema' }).click()
  await expect(page.getByText(/Inferred schema/i)).toBeVisible()
  await page.screenshot({ path: 'e2e/_artifacts/cworld-04-schema.png', fullPage: true })
})
