// apps/web/e2e/journeys/04-paste-curl.spec.ts
// Journey: paste a curl command for the cworld-be health endpoint,
// verify the live preview parses it, then add it to the block library.
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

  await page.getByRole('button', { name: 'Add block' }).click()
  await page.getByRole('menuitem', { name: /paste curl/i }).click()

  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('textbox', { name: /cURL command/i }).fill(HEALTH_CURL)

  await expect(page.getByText('GET', { exact: true }).first()).toBeVisible({ timeout: 3_000 })
  await expect(page.getByText(/api\/health/i).first()).toBeVisible()

  await page.screenshot({ path: 'e2e/_artifacts/journey-04-curl-preview.png' })

  await page.getByRole('button', { name: /add to block library/i }).click()

  await expect(page.getByText(/added to your library/i)).toBeVisible({ timeout: 5_000 })

  await expect(page.getByText(/api\/health/i).first()).toBeVisible()

  await page.screenshot({ path: 'e2e/_artifacts/journey-04-block-added.png' })
})
