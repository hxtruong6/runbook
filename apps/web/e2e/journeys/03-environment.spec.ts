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

  await page.getByRole('button', { name: 'Manage environments' }).click()

  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 })

  await page.getByRole('button', { name: 'New environment' }).first().click()

  await page.getByRole('textbox', { name: 'Name' }).fill('Local')
  await page.getByRole('textbox', { name: 'Base URL' }).fill('http://127.0.0.1:4000')

  await page.getByRole('button', { name: 'Save' }).click()

  await page.keyboard.press('Escape')

  await expect(async () => {
    const val = await page.locator('input[placeholder*="environment" i]').first().inputValue()
    expect(val).toBe('Local')
  }).toPass({ timeout: 5_000 })

  await page.screenshot({ path: 'e2e/_artifacts/journey-03-env-created.png' })
})
