import { type Page, expect } from '@playwright/test'

const PASSWORD = 'testpass1234'

export function makeStamp(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

export async function dismissNoise(page: Page): Promise<void> {
  await page.evaluate(() => {
    localStorage.setItem('rb_tour_completed', '1')
    localStorage.setItem('rb_tour_banner_dismissed', '1')
    localStorage.setItem('rb_tour_loaded', '1')
    localStorage.setItem('rb_save_sync_dismissed', '1')
  })
}

export async function signup(page: Page, stamp: string): Promise<void> {
  await page.goto('/')
  await dismissNoise(page)
  await page.reload()
  await page.getByRole('tab', { name: 'Create account' }).click()
  await page.getByRole('textbox', { name: 'Email' }).fill(`e2e-${stamp}@runbook.local`)
  await page.getByRole('textbox', { name: 'Name' }).fill('E2E Tester')
  await page.getByRole('textbox', { name: 'Password' }).fill(PASSWORD)
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByRole('button', { name: /run all/i })).toBeVisible({ timeout: 15000 })
  await expect(async () => {
    const v = await page.getByRole('textbox', { name: 'Select project' }).inputValue().catch(() => '')
    expect(v.length).toBeGreaterThan(0)
  }).toPass({ timeout: 10000 })
}

export async function login(page: Page, email: string): Promise<void> {
  await page.goto('/')
  await dismissNoise(page)
  await page.reload()
  await page.getByRole('textbox', { name: 'Email' }).fill(email)
  await page.getByRole('textbox', { name: 'Password' }).fill(PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('button', { name: /run all/i })).toBeVisible({ timeout: 15000 })
}

export async function openScenario(page: Page, name = 'My first scenario'): Promise<void> {
  const scenario = page.getByText(name, { exact: true }).first()
  await scenario.waitFor({ state: 'visible', timeout: 8000 })
  await scenario.click()
}

export async function pasteCurlToLibrary(page: Page, url: string): Promise<void> {
  const path = url.split('/').slice(3).join('/')
  await page.getByRole('button', { name: 'Block library view' }).click()
  await page.getByRole('button', { name: /paste cu?rl/i }).first().click()
  await page.locator('textarea').first().fill(`curl -X GET '${url}'`)
  await page.getByRole('button', { name: /add to block library/i }).click()
  await expect(page.getByText(path).first()).toBeVisible({ timeout: 5000 })
}

export async function addLibraryBlockToScenario(page: Page, blockPath: string): Promise<void> {
  await page.getByRole('button', { name: 'Scenarios view' }).click()
  await openScenario(page)
  await page.getByRole('button', { name: '+ Add block' }).click()
  const item = page.getByRole('menuitem', { name: new RegExp(blockPath) }).first()
  await item.scrollIntoViewIfNeeded()
  await item.click()
  await expect(page.getByText(blockPath).first()).toBeVisible({ timeout: 5000 })
}
