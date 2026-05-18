import { test, expect } from '@playwright/test'
import { makeStamp, signup } from '../fixtures/helpers'


test.describe('Journey 07 — Project Management', () => {
  test.beforeEach(async ({ context, page }) => {
    await context.clearCookies()
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
  })

  test('happy path: create project → switch → verify scenario list resets', async ({ page }) => {
    test.setTimeout(45_000)

    await signup(page, `proj-${makeStamp()}`)

    await test.step('create a new project', async () => {
      await page.getByRole('button', { name: /\+ new/i }).first().click()
      const dialog = page.getByRole('dialog', { name: 'New project' })
      await dialog.getByRole('textbox', { name: 'Project name' }).fill('My Test Project')
      await dialog.getByRole('button', { name: 'Create' }).click()
      await expect(async () => {
        const v = await page.getByRole('textbox', { name: 'Select project' }).inputValue()
        expect(v).toContain('My Test Project')
      }).toPass({ timeout: 8000 })
    })

    await test.step('new project starts with empty scenario list', async () => {
      await expect(
        page.getByText(/no scenario|empty|start blank/i).first()
      ).toBeVisible({ timeout: 5000 })
    })

    await test.step('switch back to original project', async () => {
      await page.getByRole('textbox', { name: 'Select project' }).click()
      await page.getByRole('option', { name: /My first project/i }).click()
      await expect(page.getByText(/My first scenario/i).first()).toBeVisible({ timeout: 5000 })
    })
  })

  test('happy path: delete project → next project auto-selected', async ({ page }) => {
    test.setTimeout(45_000)

    await signup(page, `proj-del-${makeStamp()}`)

    // Create a second project so we can delete one
    await page.getByRole('button', { name: /\+ new/i }).first().click()
    const dialog = page.getByRole('dialog', { name: 'New project' })
    await dialog.getByRole('textbox', { name: 'Project name' }).fill('Delete Me')
    await dialog.getByRole('button', { name: 'Create' }).click()
    await expect(async () => {
      const v = await page.getByRole('textbox', { name: 'Select project' }).inputValue()
      expect(v).toContain('Delete Me')
    }).toPass({ timeout: 8000 })

    // Delete current project
    await page.getByRole('button', { name: 'Project actions' }).first().click()
    const deleteItem = page.getByRole('menuitem', { name: /delete/i }).first()
    await deleteItem.waitFor({ timeout: 3000 })
    await deleteItem.click()
    await page.getByRole('dialog', { name: 'Delete project' }).getByRole('button', { name: 'Delete' }).click()

    // Some project should still be active
    await expect(async () => {
      const v = await page.getByRole('textbox', { name: 'Select project' }).inputValue().catch(() => '')
      expect(v.length).toBeGreaterThan(0)
    }).toPass({ timeout: 8000 })
  })

  test('edge case: empty project name is rejected', async ({ page }) => {
    test.setTimeout(30_000)

    await signup(page, `proj-empty-${makeStamp()}`)
    await page.getByRole('button', { name: /\+ new/i }).first().click()
    const dialog = page.getByRole('dialog', { name: 'New project' })
    await expect(dialog).toBeVisible()
    // Submit with empty name — dialog should stay open (no project created)
    await dialog.getByRole('button', { name: 'Create' }).click()
    await expect(dialog).toBeVisible({ timeout: 2_000 })
  })
})
