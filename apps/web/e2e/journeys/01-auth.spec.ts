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
      await page.locator(`button:has-text("${user.email.slice(0, 6)}")`).click()
    })
    await page.getByRole('menuitem', { name: /log out|sign out/i }).click()

    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible({ timeout: 10_000 })

    await signIn(page, user)
    await expect(page.getByRole('button', { name: /run all/i })).toBeVisible()
    await page.screenshot({ path: 'e2e/_artifacts/journey-01-signed-in-again.png' })
  })
})
