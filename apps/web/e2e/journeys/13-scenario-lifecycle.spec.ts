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
      // Open ⋯ menu on the new scenario
      const scenarioItem = page.getByText(/Untitled scenario/i).first()
      await scenarioItem.hover()
      await page.getByRole('button', { name: /options|⋯|more/i }).first().click()
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
      const copyItem = page.getByText(/copy/i).first()
      await copyItem.hover()
      await page.getByRole('button', { name: /options|⋯|more/i }).first().click()
      await page.getByRole('menuitem', { name: /delete/i }).click()
      await page.getByRole('button', { name: /confirm|yes|delete/i }).first().click()
      await expect(page.getByText(/copy/i)).toHaveCount(0, { timeout: 5000 })
    })
  })

  test('happy path: mark scenario as reusable → ref badge appears', async ({ page }) => {
    test.setTimeout(45_000)

    await signup(page, `scenario-ref-${makeStamp()}`)

    await page.getByRole('button', { name: 'Scenarios view' }).click()
    const scenarioItem = page.getByText('My first scenario', { exact: true }).first()
    await scenarioItem.hover()
    await page.getByRole('button', { name: /options|⋯|more/i }).first().click()
    await page.getByRole('menuitem', { name: /reusable/i }).click()

    // ref badge should appear
    await expect(page.getByText(/ref/i).first()).toBeVisible({ timeout: 5000 })
  })

  test('edge case: renaming to empty string is blocked', async ({ page }) => {
    test.setTimeout(30_000)

    await signup(page, `scenario-empty-${makeStamp()}`)
    await page.getByRole('button', { name: 'Scenarios view' }).click()
    const scenarioItem = page.getByText('My first scenario', { exact: true }).first()
    await scenarioItem.hover()
    await page.getByRole('button', { name: /options|⋯|more/i }).first().click()
    await page.getByRole('menuitem', { name: /rename/i }).click()
    await page.getByRole('textbox').last().clear()
    const saveBtn = page.getByRole('button', { name: /save|confirm/i }).last()
    const isDisabled = await saveBtn.isDisabled()
    if (!isDisabled) {
      await saveBtn.click()
      await expect(page.getByText(/required|name cannot/i)).toBeVisible({ timeout: 3000 })
    } else {
      expect(isDisabled).toBe(true)
    }
  })
})
