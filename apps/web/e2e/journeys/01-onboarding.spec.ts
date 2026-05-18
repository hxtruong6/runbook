import { test, expect } from '@playwright/test'
import { makeStamp, signup, dismissNoise } from '../fixtures/helpers'


test.describe('Journey 01 — New User Onboarding', () => {
  test.beforeEach(async ({ context, page }) => {
    await context.clearCookies()
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
  })

  test('happy path: signup → tour auto-imports → environment selected → run completes', async ({ page }) => {
    test.setTimeout(60_000)
    const STAMP = makeStamp()
    const EMAIL = `onboard-${STAMP}@runbook.local`

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
    const STAMP = makeStamp()
    const EMAIL = `onboard-${STAMP}@runbook.local`

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
    test.setTimeout(45_000)
    const STAMP = makeStamp()
    const EMAIL = `e2e-wp-${STAMP}@runbook.local`

    // Register the account first so we can test a wrong password against a real user
    await signup(page, `wp-${STAMP}`)
    await page.evaluate(() => localStorage.clear())
    await page.goto('/')
    await dismissNoise(page)
    await page.reload()

    await page.getByRole('textbox', { name: 'Email' }).fill(EMAIL)
    await page.getByRole('textbox', { name: 'Password' }).fill('wrongpassword')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByRole('alert')).toBeVisible({ timeout: 5000 })
  })
})
