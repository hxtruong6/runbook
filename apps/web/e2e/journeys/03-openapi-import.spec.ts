import { test, expect } from '@playwright/test'
import { makeStamp, signup } from '../fixtures/helpers'

const mockOpenApiJson = {
  openapi: '3.0.0',
  info: { title: 'Mock API', version: '1.0.0' },
  paths: {
    '/users': {
      get: {
        summary: 'List users',
        operationId: 'listUsers',
        responses: { '200': { description: 'Success' } },
      },
      post: {
        summary: 'Create user',
        operationId: 'createUser',
        responses: { '201': { description: 'Created' } },
      },
    },
  },
}

test.describe('Journey 03 — OpenAPI Import', () => {
  test.beforeEach(async ({ context, page }) => {
    await context.clearCookies()
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())

    // Mock the OpenAPI fetch so it's perfectly reliable and instantaneous
    await page.route('https://mock-api.example.com/openapi.json', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockOpenApiJson),
      })
    })
  })

  test('happy path: import OpenAPI spec → project created → blocks visible', async ({ page }) => {
    test.setTimeout(90_000)

    const STAMP = makeStamp()
    await signup(page, `oapi-${STAMP}`)
    
    // Actually, when a user signs up, a default project might be created for them.
    // Let's get the active project's name. It might be "My first project" or similar.
    let originalProject = ''
    await expect(async () => {
      originalProject = await page.getByRole('textbox', { name: 'Select project' }).inputValue()
      expect(originalProject.length).toBeGreaterThan(0)
    }).toPass({ timeout: 5000 })

    await test.step('open OpenAPI importer', async () => {
      await page.getByRole('button', { name: 'Import' }).first().click()
      await page.getByRole('menuitem', { name: /OpenAPI spec/i }).click()
      await expect(page.getByRole('dialog', { name: 'Import from OpenAPI' })).toBeVisible()
    })

    await test.step('load spec and see preview', async () => {
      await page.getByRole('textbox', { name: /URL|openapi\.json/i }).first().fill('https://mock-api.example.com/openapi.json')
      await page.getByRole('button', { name: 'Load' }).click()
      
      // We expect 2 operations to be found
      await expect(page.getByText(/2 operations selected/i)).toBeVisible({ timeout: 5000 })
    })

    await test.step('import all operations', async () => {
      const importBtn = page.getByRole('button', { name: /Import 2 operations/i })
      await expect(importBtn).toBeVisible()
      await importBtn.click()
      
      // Active project must change after import (the new project is usually named after the API)
      await expect(async () => {
        const newProject = await page.getByRole('textbox', { name: 'Select project' }).inputValue()
        expect(newProject).not.toBe(originalProject)
        expect(newProject).toContain('Mock API')
      }).toPass({ timeout: 8000 })
    })

    await test.step('blocks are present in the library', async () => {
      await page.getByRole('button', { name: 'Block library view' }).click()
      // "List users" and "Create user" should be visible as block names
      await expect(page.getByText('List users').first()).toBeVisible({ timeout: 5000 })
      await expect(page.getByText('Create user').first()).toBeVisible()
    })
  })
})
