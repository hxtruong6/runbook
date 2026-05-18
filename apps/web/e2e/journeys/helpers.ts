// apps/web/e2e/journeys/helpers.ts
import type { Page } from '@playwright/test'

export function makeUser() {
  const stamp = Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
  return {
    email: `journey-${stamp}@runbook.local`,
    name: 'Journey Tester',
    password: 'testpass1234',
  }
}

export async function dismissNoise(page: Page) {
  await page.evaluate(() => {
    localStorage.setItem('rb_tour_completed', '1')
    localStorage.setItem('rb_tour_banner_dismissed', '1')
    localStorage.setItem('rb_tour_loaded', '1')
    localStorage.setItem('rb_save_sync_dismissed', '1')
  })
}

export async function signUp(page: Page, user: ReturnType<typeof makeUser>) {
  await page.goto('/')
  await dismissNoise(page)
  await page.reload()
  await page.getByRole('tab', { name: 'Create account' }).click()
  await page.getByRole('textbox', { name: 'Email' }).fill(user.email)
  await page.getByRole('textbox', { name: 'Name' }).fill(user.name)
  await page.getByRole('textbox', { name: 'Password' }).fill(user.password)
  await page.getByRole('button', { name: 'Create account' }).click()
  // Wait for workspace to load
  await page.getByRole('button', { name: /run all/i }).waitFor({ timeout: 15_000 })
}

export async function signIn(page: Page, user: ReturnType<typeof makeUser>) {
  await page.goto('/')
  await dismissNoise(page)
  await page.reload()
  await page.getByRole('textbox', { name: 'Email' }).fill(user.email)
  await page.getByRole('textbox', { name: 'Password' }).fill(user.password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.getByRole('button', { name: /run all/i }).waitFor({ timeout: 15_000 })
}

export async function waitForProject(page: Page) {
  // Wait for the project selector to show a project name (not empty)
  await page.waitForFunction(
    () => {
      const el = document.querySelector('input[aria-label="Select project"], input[placeholder="Select project"]') as HTMLInputElement | null
      return el && el.value.length > 0
    },
    { timeout: 10_000 }
  )
}
