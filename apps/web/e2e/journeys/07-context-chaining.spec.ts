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

  await page.getByRole('button', { name: 'Add block' }).click()
  await page.getByRole('menuitem', { name: /paste curl/i }).click()
  await page.getByRole('textbox', { name: /cURL command/i }).fill(HEALTH_CURL)
  await page.getByRole('button', { name: /add to block library/i }).click()
  await expect(page.getByText(/added to your library/i)).toBeVisible({ timeout: 5_000 })

  await page.getByRole('button', { name: 'New scenario' }).click()
  await page.getByRole('button', { name: /add block/i }).last().click()
  await page.locator('[role="menuitem"]:has-text("health")').first().click()
  await page.getByRole('button', { name: /run all/i }).click()
  await expect(page.getByText(/200|ok/i).first()).toBeVisible({ timeout: 15_000 })

  await page.getByRole('tab', { name: /context/i }).first().click().catch(() => {})
  await expect(page.getByText('lastStatus')).toBeVisible({ timeout: 5_000 })

  await page.screenshot({ path: 'e2e/_artifacts/journey-07-context-vars.png' })
})
