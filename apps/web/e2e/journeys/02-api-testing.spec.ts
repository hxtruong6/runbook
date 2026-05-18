import { test, expect } from '@playwright/test'
import { makeStamp, signup, openScenario } from '../fixtures/helpers'

const TARGET = 'https://jsonplaceholder.typicode.com/users/1'
const TARGET_PATH = 'users/1'

test.describe('Journey 02 — API Testing via cURL Paste', () => {
  test.beforeEach(async ({ context, page }) => {
    await context.clearCookies()
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
  })

  test('happy path: paste cURL → add to scenario → run → 200 response', async ({ page }) => {
    test.setTimeout(60_000)

    await test.step('sign up and reach workspace', async () => {
      await signup(page, `curl-${makeStamp()}`)
    })

    await test.step('open paste cURL modal from block library', async () => {
      await page.getByRole('button', { name: 'Block library view' }).click()
      await page.getByRole('button', { name: /paste cu?rl/i }).first().click()
      await expect(page.locator('textarea').first()).toBeVisible()
    })

    await test.step('paste valid cURL and add to library', async () => {
      await page.locator('textarea').first().fill(`curl -X GET '${TARGET}'`)
      await page.getByRole('button', { name: /add to block library/i }).click()
      await expect(page.getByText(TARGET_PATH).first()).toBeVisible({ timeout: 5000 })
    })

    await test.step('add block from library to scenario', async () => {
      await page.getByRole('button', { name: 'Scenarios view' }).click()
      await openScenario(page, 'My first scenario')
      await page.getByRole('button', { name: '+ Add block' }).click()
      const item = page.getByRole('menuitem', { name: new RegExp(TARGET_PATH) }).first()
      await item.scrollIntoViewIfNeeded()
      await item.click()
      await expect(page.getByText(TARGET_PATH).first()).toBeVisible({ timeout: 5000 })
    })

    await test.step('run block and see 200 response', async () => {
      await page.getByRole('button', { name: /^Run$/ }).first().click()
      await expect(page.getByText(/200/)).toBeVisible({ timeout: 15000 })
    })
  })

  test('edge case: empty cURL textarea blocks submission', async ({ page }) => {
    test.setTimeout(30_000)

    await signup(page, `curl-empty-${makeStamp()}`)
    await page.getByRole('button', { name: 'Block library view' }).click()
    await page.getByRole('button', { name: /paste cu?rl/i }).first().click()
    // Button must be disabled when textarea is empty
    const addBtn = page.getByRole('button', { name: /add to block library/i })
    await expect(addBtn).toBeDisabled()
  })

  test('edge case: run button shows error state on network failure', async ({ page }) => {
    test.setTimeout(60_000)

    await signup(page, `curl-fail-${makeStamp()}`)
    await page.getByRole('button', { name: 'Block library view' }).click()
    await page.getByRole('button', { name: /paste cu?rl/i }).first().click()
    // Point at a URL that will refuse connection
    await page.locator('textarea').first().fill(`curl -X GET 'http://localhost:19999/no-such-server'`)
    await page.getByRole('button', { name: /add to block library/i }).click()

    await page.getByRole('button', { name: 'Scenarios view' }).click()
    await openScenario(page)
    await page.getByRole('button', { name: '+ Add block' }).click()
    const item = page.getByRole('menuitem', { name: /no-such-server/i }).first()
    await item.scrollIntoViewIfNeeded().catch(() => {})
    await item.click()

    await page.getByRole('button', { name: /^Run$/ }).first().click()
    await expect(
      page.getByText(/error|failed|ERR_CONNECTION/i).first()
    ).toBeVisible({ timeout: 15000 })
  })
})
