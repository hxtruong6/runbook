import { test, expect } from '@playwright/test'
import { makeStamp, signup } from '../fixtures/helpers'


test.describe('Journey 13 — Scenario Lifecycle', () => {
  test.beforeEach(async ({ context, page }) => {
    await context.clearCookies()
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
  })

  test('happy path: create → rename → duplicate → delete scenario', async ({ page }) => {
    test.setTimeout(60_000)

    await signup(page, `scenario-${makeStamp()}`)

    await test.step('create new scenario', async () => {
      await page.getByRole('button', { name: 'Scenarios view' }).click()
      // Click the + button next to "Scenarios" heading
      await page.getByRole('button', { name: /new scenario|^\+$/i }).first().click()
      await expect(page.getByText(/Untitled scenario/i).first()).toBeVisible({ timeout: 5000 })
    })

    await test.step('rename the scenario', async () => {
      // Open ⋯ menu on the new scenario — use the scenario-specific aria-label set by B2 fix
      await page.getByRole('button', { name: /Untitled scenario options/i }).click()
      await page.getByRole('menuitem', { name: /rename/i }).click()
      await page.getByRole('textbox').last().clear()
      await page.getByRole('textbox').last().fill('My Renamed Scenario')
      await page.getByRole('button', { name: /save|confirm/i }).last().click()
      await expect(page.getByText('My Renamed Scenario').first()).toBeVisible({ timeout: 5000 })
    })

    await test.step('duplicate the scenario', async () => {
      // Use TopBar More actions > Duplicate
      await page.getByRole('button', { name: /more actions|⋯/i }).last().click().catch(async () => {
        await page.getByLabel(/more actions/i).click()
      })
      await page.getByRole('menuitem', { name: /duplicate/i }).click()
      await expect(page.getByText(/copy/i).first()).toBeVisible({ timeout: 5000 })
    })

    await test.step('delete the duplicate scenario', async () => {
      await page.getByRole('button', { name: /copy.*options|My Renamed Scenario.*copy.*options/i }).click()
      await page.getByRole('menuitem', { name: /delete/i }).click()
      await page.getByRole('button', { name: /confirm|yes|delete/i }).first().click()
      await expect(page.getByText(/copy/i)).toHaveCount(0, { timeout: 5000 })
    })
  })

  test('happy path: mark scenario as reusable → ref badge appears', async ({ page }) => {
    test.setTimeout(45_000)

    await signup(page, `scenario-ref-${makeStamp()}`)

    await page.getByRole('button', { name: 'Scenarios view' }).click()
    await page.getByRole('button', { name: /My first scenario options/i }).click()
    await page.getByRole('menuitem', { name: /reusable/i }).click()

    // ref badge should appear — exact match avoids collisions with "reference", "preferences", etc.
    await expect(page.getByText('ref', { exact: true }).first()).toBeVisible({ timeout: 5000 })
  })

  test('edge case: renaming to empty string is blocked', async ({ page }) => {
    test.setTimeout(30_000)

    await signup(page, `scenario-empty-${makeStamp()}`)
    await page.getByRole('button', { name: 'Scenarios view' }).click()
    await page.getByRole('button', { name: /My first scenario options/i }).click()
    await page.getByRole('menuitem', { name: /rename/i }).click()
    await page.getByRole('textbox').last().clear()
    // Save must be disabled when name is empty
    await expect(page.getByRole('button', { name: /save|confirm/i }).last()).toBeDisabled()
  })
})
