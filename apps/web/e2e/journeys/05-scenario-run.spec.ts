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

  await page.getByRole('button', { name: 'Add block' }).click()
  await page.getByRole('menuitem', { name: /paste curl/i }).click()
  await page.getByRole('textbox').fill(HEALTH_CURL)
  await page.getByRole('button', { name: /add to block library/i }).click()
  await expect(page.getByText(/added to your library/i)).toBeVisible({ timeout: 5_000 })

  await page.getByRole('button', { name: 'New scenario' }).click()

  await page.getByRole('button', { name: /add block/i }).last().click()
  await page.locator('[role="menuitem"]:has-text("health")').first().click()

  await expect(page.getByText(/api\/health/i).first()).toBeVisible({ timeout: 5_000 })

  await page.getByRole('button', { name: /run all/i }).click()

  await expect(
    page.getByText(/200|status.*ok|ok.*status/i).first()
  ).toBeVisible({ timeout: 15_000 })

  await page.screenshot({ path: 'e2e/_artifacts/journey-05-scenario-run.png' })
})
