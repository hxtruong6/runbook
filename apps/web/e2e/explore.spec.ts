import { test, expect, type Page } from '@playwright/test'

const STAMP = Date.now().toString(36) + Math.random().toString(36).slice(2, 6)

async function dismissNoise(page: Page) {
  await page.evaluate(() => {
    localStorage.setItem('rb_tour_completed', '1')
    localStorage.setItem('rb_tour_banner_dismissed', '1')
    localStorage.setItem('rb_tour_loaded', '1')
    localStorage.setItem('rb_save_sync_dismissed', '1')
  })
}

async function signUp(page: Page, prefix: string) {
  await page.goto('/')
  await dismissNoise(page)
  await page.reload()
  await page.getByRole('tab', { name: 'Create account' }).click()
  await page.getByRole('textbox', { name: 'Email' }).fill(`${prefix}-${STAMP}@runbook.local`)
  await page.getByRole('textbox', { name: 'Name' }).fill('Tester')
  await page.getByRole('textbox', { name: 'Password' }).fill('testpass1234')
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByRole('button', { name: /run all/i })).toBeVisible({ timeout: 15000 })
}

// Helper: open paste cURL modal, fill command, submit
async function pasteCurl(page: Page, curlCmd: string) {
  // Try sidebar Paste cURL button first
  const sidebarBtn = page.getByRole('button', { name: 'Paste cURL' }).first()
  if (await sidebarBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
    await sidebarBtn.click()
  } else {
    // Use Import > Paste cURL menu
    await page.getByRole('button', { name: 'Import' }).first().click()
    await page.getByRole('menuitem', { name: /paste c.?url/i }).first().click()
  }
  // Wait for modal
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible({ timeout: 5000 })
  await dialog.locator('textarea').fill(curlCmd)
  // Click "Add to Block Library" scoped inside the dialog
  await dialog.getByRole('button', { name: 'Add to Block Library' }).click()
  await page.waitForTimeout(1500)
}

test('01: login page — sign in tab', async ({ page }) => {
  test.setTimeout(20_000)
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await dismissNoise(page)
  await page.reload()
  await page.waitForLoadState('networkidle')
  await page.screenshot({ path: '/tmp/s01-login-signin-tab.png', fullPage: true })
  // Check for guest mode link
  const guestLink = page.getByText(/continue as guest/i)
  console.log('Has "Continue as guest":', await guestLink.isVisible())
  console.log('Has "Forgot password?":', await page.getByText(/forgot password/i).isVisible())
})

test('02: login page — create account tab', async ({ page }) => {
  test.setTimeout(20_000)
  await page.goto('/')
  await dismissNoise(page)
  await page.reload()
  await page.getByRole('tab', { name: 'Create account' }).click()
  await page.screenshot({ path: '/tmp/s02-create-account-tab.png', fullPage: true })
})

test('03: sign up and initial app state', async ({ page }) => {
  test.setTimeout(60_000)
  page.on('pageerror', e => console.log('[pageerror]', e.message))
  await signUp(page, 'signup')
  await page.screenshot({ path: '/tmp/s03-after-signup.png', fullPage: true })
  console.log('Has "Start your first scenario":', await page.getByText(/start your first scenario/i).isVisible())
  // Check for the starter cards
  console.log('Has "Start blank" card:', await page.getByText('Start blank').isVisible().catch(() => false))
  console.log('Has "Import cURL" card:', await page.getByText('Import cURL').isVisible().catch(() => false))
  console.log('Has "Health Check" sample:', await page.getByText('Health Check').isVisible().catch(() => false))
})

test('04: create a project', async ({ page }) => {
  test.setTimeout(60_000)
  await signUp(page, 'newproj')
  // Click "+ New" button
  await page.getByRole('button', { name: '+ New' }).click()
  await page.screenshot({ path: '/tmp/s04-new-project-modal.png', fullPage: true })
  // Modal: "New project" with "Project name" input and "Create" button
  const modal = page.getByRole('dialog')
  await expect(modal).toBeVisible()
  await modal.getByPlaceholder('Project name').fill('cworld API')
  await page.screenshot({ path: '/tmp/s05-project-name-filled.png', fullPage: true })
  await modal.getByRole('button', { name: 'Create' }).click()
  await page.waitForTimeout(1500)
  await page.screenshot({ path: '/tmp/s06-after-project-created.png', fullPage: true })
  const projectVal = await page.getByRole('textbox', { name: 'Select project' }).inputValue()
  console.log('Active project:', projectVal) // Should be "cworld API"
  // The project switches to the new one and shows "Start your first scenario"
  // SCENARIO count should be 0 (fresh project)
  console.log('Scenarios section visible:', await page.getByText('SCENARIOS').isVisible())
})

test('05: environment setup', async ({ page }) => {
  test.setTimeout(60_000)
  await signUp(page, 'envsetup')
  await page.screenshot({ path: '/tmp/s07-main-app-env.png', fullPage: true })

  // Header contains: [menu] Runbook [owner badge] [gear1] [No environment v] [gear2] [scenario title] [Run all] [...] [</> ] [bell] [box] [user] [panel]
  // The "No environment" is a combobox (select). The gear2 next to it is env settings.
  // Let's identify all buttons in order
  const allBtns = await page.getByRole('button').all()
  const btnInfo: string[] = []
  for (let i = 0; i < Math.min(allBtns.length, 20); i++) {
    const label = await allBtns[i].getAttribute('aria-label').catch(() => '')
    const txt = (await allBtns[i].innerText().catch(() => '')).trim()
    btnInfo.push(`[${i}] label="${label}" text="${txt.slice(0,25)}"`)
  }
  console.log('All buttons on page:\n' + btnInfo.join('\n'))

  // The env dropdown is a combobox — let's click it
  const envCombo = page.getByRole('combobox').first()
  const envInput = page.locator('input[value=""], input[placeholder*="env" i]').first()
  // Try to find the env selector by its containing button/input
  const noEnvBtn = page.locator('button, [role="button"]').filter({ hasText: 'No environment' }).first()
  const hasNoEnvBtn = await noEnvBtn.isVisible().catch(() => false)
  console.log('Has "No environment" button:', hasNoEnvBtn)

  if (hasNoEnvBtn) {
    await noEnvBtn.click()
    await page.waitForTimeout(500)
    await page.screenshot({ path: '/tmp/s08-env-dropdown-open.png', fullPage: true })
    // What's in it?
    const opts = await page.getByRole('option').allInnerTexts().catch(() => [])
    const listItems = await page.locator('[class*="dropdown"] li, [class*="Select"] li, [class*="popover"] li').allInnerTexts().catch(() => [])
    console.log('Env dropdown options:', opts)
    console.log('Env dropdown list items:', listItems)
    await page.keyboard.press('Escape')
  } else {
    // Try clicking the combobox wrapper around "No environment"
    await page.locator('text="No environment"').first().click({ force: true })
    await page.waitForTimeout(500)
    await page.screenshot({ path: '/tmp/s08b-env-dropdown-forced.png', fullPage: true })
    await page.keyboard.press('Escape')
  }

  // Now try the gear icon that's right after the env dropdown in the header
  // From layout: it's the second settings icon in the header
  // Find gear-like buttons by looking at SVG icon titles
  const gearIcon2 = page.locator('button').nth(3) // index 3 based on layout
  await page.screenshot({ path: '/tmp/s09-env-gear-area.png', fullPage: true })

  // Try clicking the settings cog right of the environment dropdown
  // The gear icon is at position right after the combobox
  // Let's find it by position: it's inside the header, after the env combobox
  const envGear = page.locator('[data-testid="env-settings"], button[aria-label*="nvironment"]').first()
  if (await envGear.isVisible().catch(() => false)) {
    await envGear.click()
    await page.waitForTimeout(500)
    await page.screenshot({ path: '/tmp/s10-env-settings.png', fullPage: true })
    await page.keyboard.press('Escape')
  }

  // Try clicking all gear/settings buttons to find the env one
  const settingsBtns = await page.locator('button[aria-label]').all()
  for (const btn of settingsBtns) {
    const label = await btn.getAttribute('aria-label').catch(() => '')
    if (label) console.log('Labeled button:', label)
  }
})

test('06: paste cURL and add blocks', async ({ page }) => {
  test.setTimeout(60_000)
  page.on('pageerror', e => console.log('[pageerror]', e.message))
  await signUp(page, 'addblock')

  // Screenshot of block library empty state
  await page.screenshot({ path: '/tmp/s11-block-library-empty.png', fullPage: true })

  // Paste the cURL for GET /api/health
  await pasteCurl(page, "curl -X GET 'http://127.0.0.1:4000/api/health'")
  await page.screenshot({ path: '/tmp/s12-after-health-import.png', fullPage: true })
  console.log('Health block visible:', await page.getByText('api/health').isVisible().catch(() => false))

  // Now also check what the block library looks like with a block
  await page.screenshot({ path: '/tmp/s13-block-library-with-item.png', fullPage: true })

  // Add a second block: POST /api/auth/login
  // Re-open via Import button
  await page.getByRole('button', { name: 'Import' }).first().click()
  await page.waitForTimeout(300)
  await page.screenshot({ path: '/tmp/s14-import-menu.png', fullPage: true })
  const importMenuItems = await page.getByRole('menuitem').allInnerTexts()
  console.log('Import menu items:', importMenuItems)
  await page.getByRole('menuitem', { name: /paste c.?url/i }).first().click()

  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible({ timeout: 5000 })
  await dialog.locator('textarea').fill("curl -X POST 'http://127.0.0.1:4000/api/auth/login' -H 'Content-Type: application/json' -d '{\"email\":\"test@example.com\",\"password\":\"pass123\"}'")
  await page.screenshot({ path: '/tmp/s15-post-curl-filled.png', fullPage: true })
  await dialog.getByRole('button', { name: 'Add to Block Library' }).click()
  await page.waitForTimeout(1500)
  await page.screenshot({ path: '/tmp/s16-after-post-import.png', fullPage: true })
  console.log('auth/login block visible:', await page.getByText('auth/login').isVisible().catch(() => false))
})

test('07: build scenario with block', async ({ page }) => {
  test.setTimeout(60_000)
  page.on('pageerror', e => console.log('[pageerror]', e.message))
  await signUp(page, 'buildscen')

  // Add health check block
  await pasteCurl(page, "curl -X GET 'http://127.0.0.1:4000/api/health'")

  // Navigate to "My first scenario"
  const myScenario = page.getByText('My first scenario').first()
  if (await myScenario.isVisible().catch(() => false)) {
    await myScenario.click()
    await page.waitForTimeout(500)
  }
  await page.screenshot({ path: '/tmp/s17-empty-scenario.png', fullPage: true })

  // "+ Add block" button opens a menu of available blocks
  await page.getByRole('button', { name: '+ Add block' }).click()
  await page.waitForTimeout(300)
  await page.screenshot({ path: '/tmp/s18-add-block-menu.png', fullPage: true })

  const menuItems = await page.getByRole('menuitem').allInnerTexts()
  console.log('Add block menu items:', menuItems)

  // Click the health block
  const healthItem = page.getByRole('menuitem').filter({ hasText: /api.health|health/i }).first()
  if (await healthItem.isVisible().catch(() => false)) {
    await healthItem.click()
    await page.waitForTimeout(1000)
    await page.screenshot({ path: '/tmp/s19-block-in-scenario.png', fullPage: true })
    console.log('Block added to scenario successfully')
  } else {
    await page.keyboard.press('Escape')
    console.log('Health block not in menu. Menu had:', menuItems)
  }

  await page.screenshot({ path: '/tmp/s20-scenario-state.png', fullPage: true })

  // Try clicking the block in the scenario to see if it expands
  const blockInScenario = page.locator('[class*="block"i]').filter({ hasText: /api.health|health/i }).first()
  if (await blockInScenario.isVisible().catch(() => false)) {
    await blockInScenario.click()
    await page.waitForTimeout(500)
    await page.screenshot({ path: '/tmp/s21-block-clicked.png', fullPage: true })
  }

  // Look for a pencil/edit icon on the block
  const editBtns = await page.locator('button[aria-label*="edit" i], button[aria-label*="Edit"]').allInnerTexts()
  console.log('Edit buttons:', editBtns)
})

test('08: run scenario and view results', async ({ page }) => {
  test.setTimeout(90_000)
  page.on('pageerror', e => console.log('[pageerror]', e.message))
  page.on('response', async resp => {
    const url = resp.url()
    if (url.includes('127.0.0.1:4000')) {
      try {
        const body = await resp.text()
        console.log('[cworld]', url, resp.status(), body.slice(0, 300))
      } catch {}
    }
  })

  await signUp(page, 'runscen')

  // Add health check block and add to scenario
  await pasteCurl(page, "curl -X GET 'http://127.0.0.1:4000/api/health'")

  const myScenario = page.getByText('My first scenario').first()
  if (await myScenario.isVisible().catch(() => false)) {
    await myScenario.click()
    await page.waitForTimeout(500)
  }

  await page.getByRole('button', { name: '+ Add block' }).click()
  await page.waitForTimeout(300)
  const healthItem = page.getByRole('menuitem').filter({ hasText: /api.health|health/i }).first()
  if (await healthItem.isVisible().catch(() => false)) {
    await healthItem.click()
    await page.waitForTimeout(1000)
  } else {
    await page.keyboard.press('Escape')
    console.log('Could not add health block to scenario')
    return
  }

  await page.screenshot({ path: '/tmp/s22-ready-to-run.png', fullPage: true })

  // Click Run button
  const runBtn = page.getByRole('button', { name: /^Run$/ }).first()
  await expect(runBtn).toBeVisible({ timeout: 5000 })
  await runBtn.click()

  // Wait for network request to complete
  await page.waitForTimeout(5000)
  await page.screenshot({ path: '/tmp/s23-run-in-progress.png', fullPage: true })
  await page.waitForTimeout(3000)
  await page.screenshot({ path: '/tmp/s24-run-complete.png', fullPage: true })

  // Check what we see
  const bodyText = await page.locator('body').innerText()
  const relevantLines = bodyText.split('\n').filter(l => /200|status|ok|health|error|result|response|ms|failed|success/i.test(l)).map(l => l.trim()).filter(Boolean)
  console.log('Relevant page text after run:', relevantLines.slice(0, 20))

  // Look for the schema inference notification
  const schemaNotif = page.getByText(/response schema captured/i)
  console.log('Schema inference visible:', await schemaNotif.isVisible().catch(() => false))

  // Look for View schema button
  const viewSchemaBtn = page.getByRole('button', { name: /view schema/i })
  console.log('View schema button visible:', await viewSchemaBtn.isVisible().catch(() => false))

  if (await viewSchemaBtn.isVisible().catch(() => false)) {
    await viewSchemaBtn.click()
    await page.waitForTimeout(500)
    await page.screenshot({ path: '/tmp/s25-schema-view.png', fullPage: true })
    await page.keyboard.press('Escape')
  }

  // Expand Run History
  const runHistory = page.getByText('RUN HISTORY')
  if (await runHistory.isVisible().catch(() => false)) {
    await runHistory.click()
    await page.waitForTimeout(500)
    await page.screenshot({ path: '/tmp/s26-run-history-expanded.png', fullPage: true })
  }
})

test('09: graph view', async ({ page }) => {
  test.setTimeout(90_000)
  page.on('pageerror', e => console.log('[pageerror]', e.message))

  await signUp(page, 'graph')

  await pasteCurl(page, "curl -X GET 'http://127.0.0.1:4000/api/health'")

  const myScenario = page.getByText('My first scenario').first()
  if (await myScenario.isVisible().catch(() => false)) await myScenario.click()
  await page.waitForTimeout(300)

  await page.getByRole('button', { name: '+ Add block' }).click()
  await page.waitForTimeout(300)
  const healthItem = page.getByRole('menuitem').filter({ hasText: /api.health|health/i }).first()
  if (await healthItem.isVisible().catch(() => false)) {
    await healthItem.click()
    await page.waitForTimeout(500)
  } else {
    await page.keyboard.press('Escape')
  }

  // Run once to get data
  const runBtn = page.getByRole('button', { name: /^Run$/ }).first()
  if (await runBtn.isVisible().catch(() => false)) {
    await runBtn.click()
    await page.waitForTimeout(5000)
  }

  // Now switch to Graph view
  const graphLink = page.getByText('Graph').first()
  if (await graphLink.isVisible().catch(() => false)) {
    await graphLink.click()
    await page.waitForTimeout(1000)
    await page.screenshot({ path: '/tmp/s27-graph-view.png', fullPage: true })
  }

  // Switch back to List
  const listLink = page.getByText('List').first()
  if (await listLink.isVisible().catch(() => false)) {
    await listLink.click()
    await page.waitForTimeout(500)
  }

  await page.screenshot({ path: '/tmp/s28-back-to-list.png', fullPage: true })
})

test('10: explore header and right panel controls', async ({ page }) => {
  test.setTimeout(60_000)
  page.on('pageerror', e => console.log('[pageerror]', e.message))

  await signUp(page, 'header')

  await page.screenshot({ path: '/tmp/s29-full-header.png', fullPage: true })

  // Identify every button in the header precisely
  // Header layout from screenshots:
  // [collapse sidebar] [Runbook logo+text] [owner badge] [project gear] [No environment v] [env gear] [scenario title] [Run all] [...] [</> ] [bell] [box] [user] [panel toggle]
  const allBtns = await page.getByRole('button').all()
  console.log(`Total page buttons: ${allBtns.length}`)
  for (let i = 0; i < Math.min(allBtns.length, 25); i++) {
    const label = await allBtns[i].getAttribute('aria-label').catch(() => '')
    const txt = (await allBtns[i].innerText().catch(() => '')).trim().replace(/\s+/g, ' ')
    const title = await allBtns[i].getAttribute('title').catch(() => '')
    if (label || txt || title) {
      console.log(`btn[${i}]: label="${label}" title="${title}" text="${txt.slice(0,30)}"`)
    }
  }

  // Click the "..." button in the header (3-dots menu)
  const dotsBtn = allBtns[8] // approximate position
  for (let i = 6; i < Math.min(allBtns.length, 16); i++) {
    const txt = (await allBtns[i].innerText().catch(() => '')).trim()
    const label = await allBtns[i].getAttribute('aria-label').catch(() => '')
    if (txt === '...' || label?.includes('more') || label?.includes('More')) {
      await allBtns[i].click()
      await page.waitForTimeout(300)
      await page.screenshot({ path: `/tmp/s30-dots-menu-${i}.png`, fullPage: true })
      const menuItems = await page.getByRole('menuitem').allInnerTexts().catch(() => [])
      console.log(`Dots menu [${i}] items:`, menuItems)
      await page.keyboard.press('Escape')
      await page.waitForTimeout(200)
      break
    }
  }

  // Click the </> (code view?) button
  for (let i = 0; i < Math.min(allBtns.length, 20); i++) {
    const label = await allBtns[i].getAttribute('aria-label').catch(() => '')
    if (label && /code|snippet|curl|http/i.test(label)) {
      await allBtns[i].click()
      await page.waitForTimeout(300)
      await page.screenshot({ path: '/tmp/s31-code-view.png', fullPage: true })
      await page.keyboard.press('Escape')
      break
    }
  }

  // Click the bell/notifications button
  for (let i = 0; i < Math.min(allBtns.length, 20); i++) {
    const label = await allBtns[i].getAttribute('aria-label').catch(() => '')
    if (label && /notif|bell|alert/i.test(label)) {
      await allBtns[i].click()
      await page.waitForTimeout(300)
      await page.screenshot({ path: '/tmp/s32-notifications.png', fullPage: true })
      await page.keyboard.press('Escape')
      break
    }
  }

  // Click the user/profile button
  for (let i = 0; i < Math.min(allBtns.length, 20); i++) {
    const label = await allBtns[i].getAttribute('aria-label').catch(() => '')
    if (label && /user|profile|account|member/i.test(label)) {
      await allBtns[i].click()
      await page.waitForTimeout(300)
      await page.screenshot({ path: '/tmp/s33-user-menu.png', fullPage: true })
      await page.keyboard.press('Escape')
      break
    }
  }

  await page.screenshot({ path: '/tmp/s34-header-final.png', fullPage: true })
})

test('11: block editor modal', async ({ page }) => {
  test.setTimeout(90_000)
  page.on('pageerror', e => console.log('[pageerror]', e.message))

  await signUp(page, 'blockedit')

  await pasteCurl(page, "curl -X GET 'http://127.0.0.1:4000/api/health'")

  // In block library, look for the block and try to open its editor
  await page.screenshot({ path: '/tmp/s35-block-in-library.png', fullPage: true })

  // The block library shows a small row item — hover/click to get options
  const healthBlock = page.locator('text=api/health').first()
  if (await healthBlock.isVisible().catch(() => false)) {
    // Hover to reveal buttons
    await healthBlock.hover()
    await page.waitForTimeout(300)
    await page.screenshot({ path: '/tmp/s36-block-hovered.png', fullPage: true })

    // Look for edit button that appears on hover
    const editBtn = page.locator('button[aria-label*="edit" i]').first()
    if (await editBtn.isVisible().catch(() => false)) {
      await editBtn.click()
      await page.waitForTimeout(500)
      await page.screenshot({ path: '/tmp/s37-block-editor-modal.png', fullPage: true })
      await page.keyboard.press('Escape')
    }

    // Try clicking the block name itself
    await healthBlock.click()
    await page.waitForTimeout(500)
    await page.screenshot({ path: '/tmp/s38-block-clicked.png', fullPage: true })
  }

  // Now add it to the scenario and try to edit from there
  const myScenario = page.getByText('My first scenario').first()
  if (await myScenario.isVisible().catch(() => false)) await myScenario.click()
  await page.waitForTimeout(300)

  await page.getByRole('button', { name: '+ Add block' }).click()
  await page.waitForTimeout(300)
  const healthItem = page.getByRole('menuitem').filter({ hasText: /api.health|health/i }).first()
  if (await healthItem.isVisible().catch(() => false)) {
    await healthItem.click()
    await page.waitForTimeout(1000)
    await page.screenshot({ path: '/tmp/s39-block-in-scenario-edit.png', fullPage: true })

    // Hover over the block in scenario to reveal controls
    const blockInScenario = page.locator('[class*="block"i]').filter({ hasText: /api.health|health/i }).first()
    if (await blockInScenario.isVisible().catch(() => false)) {
      await blockInScenario.hover()
      await page.waitForTimeout(300)
      await page.screenshot({ path: '/tmp/s40-block-in-scenario-hovered.png', fullPage: true })

      // Try clicking pencil/edit button
      const pencilBtn = page.locator('button[aria-label*="edit" i], button[aria-label*="Edit"]').first()
      if (await pencilBtn.isVisible().catch(() => false)) {
        await pencilBtn.click()
        await page.waitForTimeout(500)
        await page.screenshot({ path: '/tmp/s41-block-editor-in-scenario.png', fullPage: true })
        // Explore what the block editor looks like
        const editorContent = await page.getByRole('dialog').innerText().catch(() => 'no dialog')
        console.log('Block editor content:', editorContent.slice(0, 300))
        await page.keyboard.press('Escape')
      }
    }
  }
})

test('12: scenario options and new scenario', async ({ page }) => {
  test.setTimeout(60_000)
  page.on('pageerror', e => console.log('[pageerror]', e.message))

  await signUp(page, 'scenmgmt')

  // Look at the SCENARIOS section header with the + button
  const scenPlusBtn = page.locator('text=SCENARIOS').locator('..').locator('button').first()
  await page.screenshot({ path: '/tmp/s42-scenarios-section.png', fullPage: true })

  // Click the + next to SCENARIOS to create a new one
  if (await scenPlusBtn.isVisible().catch(() => false)) {
    await scenPlusBtn.click()
    await page.waitForTimeout(500)
    await page.screenshot({ path: '/tmp/s43-new-scenario.png', fullPage: true })
    await page.keyboard.press('Escape')
  }

  // Click the ... on My first scenario
  const scenarioRow = page.locator('text=My first scenario').first().locator('..')
  await scenarioRow.hover()
  await page.waitForTimeout(300)
  await page.screenshot({ path: '/tmp/s44-scenario-hovered.png', fullPage: true })

  // Find the ... button for the scenario
  const scenarioDots = page.getByRole('button').filter({ hasText: '...' })
  const dotsCount = await scenarioDots.count()
  console.log('... buttons count:', dotsCount)
  if (dotsCount > 0) {
    await scenarioDots.first().click()
    await page.waitForTimeout(300)
    await page.screenshot({ path: '/tmp/s45-scenario-context-menu.png', fullPage: true })
    const menuItems = await page.getByRole('menuitem').allInnerTexts()
    console.log('Scenario context menu items:', menuItems)
    await page.keyboard.press('Escape')
  }

  // Navigate to "My first scenario" and look at the title area
  await page.getByText('My first scenario').first().click()
  await page.waitForTimeout(500)
  await page.screenshot({ path: '/tmp/s46-scenario-selected.png', fullPage: true })
})

test('13: context panel and schema panel (right side)', async ({ page }) => {
  test.setTimeout(90_000)
  page.on('pageerror', e => console.log('[pageerror]', e.message))

  await signUp(page, 'ctxpanel')

  await pasteCurl(page, "curl -X GET 'http://127.0.0.1:4000/api/health'")

  const myScenario = page.getByText('My first scenario').first()
  if (await myScenario.isVisible().catch(() => false)) await myScenario.click()
  await page.waitForTimeout(300)

  await page.getByRole('button', { name: '+ Add block' }).click()
  await page.waitForTimeout(300)
  const healthItem = page.getByRole('menuitem').filter({ hasText: /api.health|health/i }).first()
  if (await healthItem.isVisible().catch(() => false)) {
    await healthItem.click()
    await page.waitForTimeout(1000)
  } else {
    await page.keyboard.press('Escape')
  }

  // Run
  const runBtn = page.getByRole('button', { name: /^Run$/ }).first()
  if (await runBtn.isVisible().catch(() => false)) {
    await runBtn.click()
    await page.waitForTimeout(6000)
  }

  await page.screenshot({ path: '/tmp/s47-after-run-with-panels.png', fullPage: true })

  // Context tab (right panel)
  const contextTab = page.getByRole('tab', { name: 'Context' })
  if (await contextTab.isVisible().catch(() => false)) {
    await contextTab.click()
    await page.waitForTimeout(300)
    await page.screenshot({ path: '/tmp/s48-context-panel.png', fullPage: true })
    const contextContent = await page.locator('[class*="Context"], [aria-label*="context"]').first().innerText().catch(() => 'n/a')
    console.log('Context panel content:', contextContent.slice(0, 300))
  }

  // Schema tab (right panel)
  const schemaTab = page.getByRole('tab', { name: 'Schema' })
  if (await schemaTab.isVisible().catch(() => false)) {
    await schemaTab.click()
    await page.waitForTimeout(300)
    await page.screenshot({ path: '/tmp/s49-schema-panel.png', fullPage: true })
    const schemaContent = await page.locator('[class*="Schema"], [aria-label*="schema"]').first().innerText().catch(() => 'n/a')
    console.log('Schema panel content:', schemaContent.slice(0, 300))
  }

  await page.screenshot({ path: '/tmp/s50-final.png', fullPage: true })
  console.log('Final URL:', page.url())
})
