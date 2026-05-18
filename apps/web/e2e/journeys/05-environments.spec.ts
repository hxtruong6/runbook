import { test, expect } from '@playwright/test'
import { makeStamp, signup } from '../fixtures/helpers'

test.describe('Journey 05 — Environment & Auth Configuration', () => {
  test.beforeEach(async ({ context, page }) => {
    await context.clearCookies()
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
  })

  test('happy path: create Bearer env → switch to it → env shows in TopBar', async ({ page }) => {
    test.setTimeout(45_000)

    const STAMP = makeStamp()
    await signup(page, `env-${STAMP}`)

    await test.step('open environment manager', async () => {
      await page.getByRole('button', { name: 'Manage environments' }).click()
      await expect(page.getByRole('dialog', { name: 'Environments' })).toBeVisible({ timeout: 5000 })
    })

    await test.step('add a new Bearer environment', async () => {
      await page.getByRole('button', { name: 'New environment' }).click()
      await page.getByRole('textbox', { name: 'Name' }).fill('Production')
      await page.getByRole('textbox', { name: 'Base URL' }).fill('https://api.example.com')
      
      // Select Bearer auth
      await page.getByText('Bearer', { exact: true }).click()
      await page.getByLabel('Token').fill('my-secret-token')
      await page.getByRole('button', { name: 'Save' }).click()
    })

    await test.step('environment appears with Bearer badge', async () => {
      await expect(page.getByText('Production').first()).toBeVisible({ timeout: 5000 })
      await expect(page.getByText(/bearer/i).first()).toBeVisible({ timeout: 3000 })
    })

    await test.step('close modal and verify env in TopBar', async () => {
      await page.keyboard.press('Escape')
      
      // Since it's automatically active after creation, or if not we select it
      // Actually it may not be automatically active!
      // Let's explicitly select it
      await page.getByRole('combobox', { name: 'No environment' }).click()
      await page.getByRole('option', { name: 'Production' }).click()
      await expect(page.getByRole('combobox', { name: 'Production' })).toBeVisible({ timeout: 3000 })
    })
  })

  test('edge case: duplicate environment name shows validation error', async ({ page }) => {
    test.setTimeout(45_000)

    const STAMP = makeStamp()
    await signup(page, `env-dup-${STAMP}`)
    
    // Create first env
    await page.getByRole('button', { name: 'Manage environments' }).click()
    await page.getByRole('button', { name: 'New environment' }).click()
    await page.getByRole('textbox', { name: 'Name' }).fill('Staging')
    await page.getByRole('textbox', { name: 'Base URL' }).fill('https://api.staging.com')
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText('Staging').first()).toBeVisible({ timeout: 5000 })

    // Try to create second env with same name
    await page.getByRole('button', { name: 'New environment' }).click()
    await page.getByRole('textbox', { name: 'Name' }).fill('Staging')
    await page.getByRole('textbox', { name: 'Base URL' }).fill('https://api.staging2.com')
    await page.getByRole('button', { name: 'Save' }).click()
    
    await expect(page.getByText(/must be unique/i)).toBeVisible({ timeout: 3000 })
  })
})
