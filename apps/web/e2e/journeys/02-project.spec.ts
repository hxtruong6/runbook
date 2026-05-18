// apps/web/e2e/journeys/02-project.spec.ts
// Journey: create a new named project, verify it becomes active.
import { test, expect } from '@playwright/test'
import { makeUser, signUp, waitForProject } from './helpers'

test('create project becomes active', async ({ context, page }) => {
  test.setTimeout(30_000)
  await context.clearCookies()
  await page.evaluate(() => localStorage.clear()).catch(() => {})

  const user = makeUser()
  await signUp(page, user)
  await waitForProject(page)

  await page.getByRole('button', { name: '+ New' }).click()

  const projectName = `cworld-${Date.now().toString(36)}`
  await page.getByRole('textbox', { name: /project name/i }).fill(projectName)
  await page.getByRole('button', { name: 'Create' }).click()

  await expect(async () => {
    const val = await page.locator('input[placeholder*="project" i]').first().inputValue()
    expect(val).toBe(projectName)
  }).toPass({ timeout: 10_000 })

  await page.screenshot({ path: 'e2e/_artifacts/journey-02-project-created.png' })
})
