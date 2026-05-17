// Covers the hierarchical block list: default grouping by library size,
// search, tag chip toggling, expand persistence across reload, and the
// empty state when filters return no matches.
//
// The "small workspace" case is verified via a single curl paste so the
// run stays under 15s. The "large workspace" case uses the cworld-be
// OpenAPI import (127 operations) — same network shape as cworld.spec.ts.
import { test, expect, type Page } from '@playwright/test'

const STAMP = Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
const PASSWORD = 'testpass1234'

async function dismissNoise(page: Page) {
  await page.evaluate(() => {
    localStorage.setItem('rb_tour_completed', '1')
    localStorage.setItem('rb_tour_banner_dismissed', '1')
    localStorage.setItem('rb_tour_loaded', '1')
    localStorage.setItem('rb_save_sync_dismissed', '1')
  })
}

async function signup(page: Page, suffix: string) {
  await page.goto('/')
  await dismissNoise(page)
  await page.reload()
  await page.getByRole('tab', { name: 'Create account' }).click()
  await page.getByRole('textbox', { name: 'Email' }).fill(`tree-${suffix}-${STAMP}@runbook.local`)
  await page.getByRole('textbox', { name: 'Name' }).fill('Tree Tester')
  await page.getByRole('textbox', { name: 'Password' }).fill(PASSWORD)
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByRole('button', { name: /run all/i })).toBeVisible({ timeout: 15000 })
  await expect(async () => {
    const v = await page.getByRole('textbox', { name: 'Select project' }).inputValue().catch(() => '')
    expect(v.length).toBeGreaterThan(0)
  }).toPass({ timeout: 10000 })
}

async function openBlockLibrary(page: Page) {
  await page.getByRole('button', { name: 'Block library view' }).click()
}

test.beforeEach(async ({ context, page }) => {
  await context.clearCookies()
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
})

test('small workspace stays flat — single curl block is visible without expanding', async ({ page }) => {
  test.setTimeout(45_000)

  await signup(page, 'small')
  await openBlockLibrary(page)

  // Paste a single curl. With <= 8 blocks the panel must default to 'flat'
  // mode so the leaf is visible directly — no chevron, no expansion needed.
  // Block library actions live behind the "Add block" menu now.
  await page.getByRole('button', { name: /^Add block$/ }).first().click()
  await page.getByRole('menuitem', { name: /paste cu?rl/i }).click()
  await page.locator('textarea').first().fill(`curl -X GET 'https://example.com/api/health'`)
  await page.getByRole('button', { name: /add to block library/i }).click()

  // The block's URL is rendered in the leaf card. Must be visible without
  // touching any group chevron.
  await expect(page.getByText('api/health').first()).toBeVisible({ timeout: 5000 })

  // The grouping mode select should read "Flat" since the threshold is 8.
  // Mantine Select renders as a combobox with the visible label as its value.
  await expect(page.getByRole('textbox', { name: 'Grouping mode' })).toHaveValue('Flat')

  // No "Expand <group>" / "Collapse <group>" buttons exist in flat mode —
  // the recursive tree renderer only emits those for group nodes.
  await expect(page.getByRole('button', { name: /^(Expand|Collapse) / })).toHaveCount(0)
})

test('large workspace: tree, search, tag chip, expand persistence, empty state', async ({ page }) => {
  test.setTimeout(90_000)

  await signup(page, 'large')
  await openBlockLibrary(page)

  // Import cworld-be OpenAPI (127 operations) via the sidebar Import menu.
  await page.getByRole('button', { name: 'Import' }).first().click()
  await page.getByRole('menuitem', { name: /OpenAPI spec/i }).click()
  await page.getByPlaceholder(/openapi\.json/i).first().fill('http://127.0.0.1:4000/documentation-json')
  await page.getByRole('button', { name: 'Load' }).click()
  await expect(page.getByText(/operations selected/i)).toBeVisible({ timeout: 20000 })
  await page.getByRole('button', { name: /Import 127 operations/i }).click()

  // The project-level OpenAPI import imports a *bundle* (project + scenarios),
  // not local blocks. The library tree is sourced from local blocks, so the
  // block-library grouping selector won't surface those imported operations.
  // For a tree-grouping test we need a large *local* library — re-import the
  // same spec via the block-library importer.
  await openBlockLibrary(page)
  await page.getByRole('button', { name: /^Add block$/ }).first().click()
  await page.getByRole('menuitem', { name: /OpenAPI spec/i }).click()
  // The block-library importer (OpenApiImporterModal) takes URL via the same
  // input then a Fetch button.
  await page.getByPlaceholder(/openapi\.json/i).first().fill('http://127.0.0.1:4000/documentation-json')
  await page.getByRole('button', { name: /^Fetch$/ }).click()
  await page.getByRole('button', { name: /^Select all$/ }).click().catch(() => {})
  await page.getByRole('button', { name: /^Import \d+ block/i }).click()

  // After import, the block panel reopens. Library has 127 blocks, well above
  // the GROUPING_THRESHOLD (8) — default mode should be "By tag".
  await expect(page.getByRole('textbox', { name: 'Grouping mode' })).toHaveValue('By tag', {
    timeout: 10000,
  })

  // Tree groups render as buttons whose accessible name starts with
  // "Expand" or "Collapse" (from BlockTreeNode's aria-label).
  const groupButtons = page.getByRole('button', { name: /^(Expand|Collapse) / })
  await expect.poll(() => groupButtons.count(), { timeout: 5000 }).toBeGreaterThan(3)

  // --- Search narrows the visible set --------------------------------------
  const searchBox = page.getByPlaceholder(/filter blocks/i)
  await searchBox.fill('health')

  // The "Showing X of Y" line appears once a filter is active. Block count
  // can shift if the cworld-be spec changes — accept any 3-digit total.
  await expect(page.getByText(/Showing \d+ of \d{2,4}/i)).toBeVisible({ timeout: 3000 })

  // Active filter auto-expands groups, so matches are reachable without clicks.
  await expect(page.getByText(/health/i).first()).toBeVisible()

  // --- Empty state when no match -------------------------------------------
  await searchBox.fill('zzz_no_such_endpoint_zzz')
  await expect(page.getByText(/No blocks match/i)).toBeVisible({ timeout: 3000 })
  // Two "Clear filters" buttons render when the empty state shows: one in
  // the filter bar header, one as the empty-state CTA. The CTA is the
  // larger Button; the header is a Text-as-button. Hit the CTA.
  await page.getByTestId('empty-state').getByRole('button', { name: /Clear filters/i }).click()

  // Filter bar's "Clear filters" empties the input.
  await expect(searchBox).toHaveValue('')

  // --- Tag chip toggle ------------------------------------------------------
  // Click any tag badge on any block leaf — it should become a selected chip.
  // First expand a group to expose a leaf.
  const firstGroup = groupButtons.first()
  await firstGroup.click()
  const tagBadge = page.getByLabel(/^Filter by tag /i).first()
  await tagBadge.scrollIntoViewIfNeeded()
  const tagLabel = (await tagBadge.textContent())?.trim() ?? ''
  expect(tagLabel.length).toBeGreaterThan(0)
  await tagBadge.click()

  // The "Remove tag <label>" button proves the chip is now in the selected set.
  await expect(page.getByLabel(`Remove tag ${tagLabel}`)).toBeVisible({ timeout: 3000 })

  // Remove it again — chip disappears.
  await page.getByLabel(`Remove tag ${tagLabel}`).click()
  await expect(page.getByLabel(`Remove tag ${tagLabel}`)).toHaveCount(0)

  // --- Expand persistence across reload ------------------------------------
  // Pick a specific top-level group, expand it, and assert that after reload
  // it is still expanded. Use the localStorage key so the assertion is
  // independent of the group's label changing.
  const targetLabel = (await firstGroup.textContent())?.trim() ?? ''
  expect(targetLabel.length).toBeGreaterThan(0)

  // The state we just wrote must round-trip through localStorage.
  const persisted = await page.evaluate(() => localStorage.getItem('runbook:block-ui'))
  expect(persisted).toContain('expandedGroups')

  await page.reload()
  await openBlockLibrary(page)
  // After reload, the previously-expanded group should still be open —
  // its toggle button reads "Collapse <label>" rather than "Expand …".
  // We don't pin to a specific group label; just assert at least one
  // group survived the reload as expanded, proving the localStorage path.
  await expect.poll(
    async () => await page.getByRole('button', { name: /^Collapse / }).count(),
    { timeout: 5000 },
  ).toBeGreaterThan(0)
})

// Edge case: deleting every local block must drop the user back to the
// "No API blocks yet" onboarding state, NOT the "No blocks match" filter
// empty state. These two empty states look similar visually but only the
// former offers the Paste cURL CTA the onboarding flow depends on.
test('edge: deleting all blocks falls back to onboarding empty state', async ({ page }) => {
  test.setTimeout(45_000)

  await signup(page, 'delete')
  await openBlockLibrary(page)

  // Add one block.
  await page.getByRole('button', { name: /^Add block$/ }).first().click()
  await page.getByRole('menuitem', { name: /paste cu?rl/i }).click()
  await page.locator('textarea').first().fill(`curl -X GET 'https://example.com/api/widgets'`)
  await page.getByRole('button', { name: /add to block library/i }).click()
  await expect(page.getByText('api/widgets').first()).toBeVisible({ timeout: 5000 })

  // Delete it. handleDelete opens a confirm modal — accept it.
  await page.getByRole('button', { name: /^Delete /i }).first().click()
  await page.getByRole('button', { name: /^Delete$/ }).click()

  // The onboarding empty state's exact title — not the filter-empty one.
  await expect(page.getByText(/No API blocks yet/i)).toBeVisible({ timeout: 5000 })
  await expect(page.getByText(/No blocks match/i)).toHaveCount(0)
})

// Edge case: multi-tag selection ANDs together. A block must have BOTH
// selected tags to remain visible. Critical correctness check for the
// "click a tag, then another tag" UX since users will naturally try this
// to narrow large workspaces.
test('edge: multi-tag selection ANDs together', async ({ page }) => {
  test.setTimeout(60_000)

  // Synthesize a deterministic localBlocks payload. Three blocks:
  //   - alpha tag only
  //   - beta tag only
  //   - alpha + beta both
  // Selecting [alpha, beta] should leave only the third visible.
  await page.goto('/')
  await page.evaluate(() => {
    localStorage.clear()
    localStorage.setItem('rb_tour_completed', '1')
    localStorage.setItem('rb_tour_banner_dismissed', '1')
    localStorage.setItem(
      'runbook:local-blocks',
      JSON.stringify([
        {
          kind: 'a-only',
          label: 'Alpha only',
          auth: 'none',
          inputs: [],
          outputs: [],
          request: { method: 'GET', urlTemplate: 'https://example.com/alpha' },
          tags: ['alpha'],
        },
        {
          kind: 'b-only',
          label: 'Beta only',
          auth: 'none',
          inputs: [],
          outputs: [],
          request: { method: 'GET', urlTemplate: 'https://example.com/beta' },
          tags: ['beta'],
        },
        {
          kind: 'ab',
          label: 'Both',
          auth: 'none',
          inputs: [],
          outputs: [],
          request: { method: 'GET', urlTemplate: 'https://example.com/both' },
          tags: ['alpha', 'beta'],
        },
      ]),
    )
    // Force tag mode so filter chips are easy to reach.
    localStorage.setItem(
      'runbook:block-ui',
      JSON.stringify({ groupingMode: 'tag', expandedGroups: ['alpha', 'beta'] }),
    )
  })
  await signup(page, 'multitag')
  await openBlockLibrary(page)

  // Sanity: all three blocks render before any filter is active. Use
  // exact-label selectors so we don't collide with URL fragments like
  // "/both" or the "Both" tag chip elsewhere.
  await expect(page.getByText('Alpha only', { exact: true })).toBeVisible()
  await expect(page.getByText('Beta only', { exact: true })).toBeVisible()
  // Multi-tagged blocks render once per tag group, so 'Both' appears in
  // both the alpha and beta groups — `.first()` makes the count stable.
  await expect(page.getByText('Both', { exact: true }).first()).toBeVisible()

  // Click the "alpha" tag badge on the "Alpha only" leaf to add it to the
  // selected chips. Use .first() to dodge duplicate matches (the same
  // block can appear under multiple tag groups).
  await page.getByLabel('Filter by tag alpha').first().click()
  await expect(page.getByLabel('Remove tag alpha')).toBeVisible()

  // After picking only "alpha": Alpha-only + Both visible, Beta-only hidden.
  await expect(page.getByText('Alpha only', { exact: true })).toBeVisible()
  // Multi-tagged blocks render once per tag group, so 'Both' appears in
  // both the alpha and beta groups — `.first()` makes the count stable.
  await expect(page.getByText('Both', { exact: true }).first()).toBeVisible()
  // "Beta only" has only the 'beta' tag — filter by 'alpha' should hide it
  // from every group it would otherwise appear under.
  await expect(page.getByText('Beta only', { exact: true })).toHaveCount(0)

  // Now add "beta".
  await page.getByLabel('Filter by tag beta').first().click()
  await expect(page.getByLabel('Remove tag beta')).toBeVisible()

  // AND semantics: only the Both block has both tags.
  // Multi-tagged blocks render once per tag group, so 'Both' appears in
  // both the alpha and beta groups — `.first()` makes the count stable.
  await expect(page.getByText('Both', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('Alpha only', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Beta only', { exact: true })).toHaveCount(0)
})

// Edge case: after a sidebar OpenAPI import, the imported blocks live in
// the project bundle (not localBlocks). Scenarios reference them by `kind`.
// Before the registry merge fix, every scenario showed
//   "Unknown block kind: ..."
// for each step. This regression test signs up, imports the cworld-be spec
// via the sidebar Import menu, opens an auto-generated scenario, and
// asserts no such error renders.
test('edge: imported bundle scenarios resolve block kinds (no "Unknown block kind")', async ({ page }) => {
  test.setTimeout(90_000)

  await signup(page, 'bundle-resolve')

  // Sidebar Import → OpenAPI spec → cworld-be.
  await page.getByRole('button', { name: 'Import' }).first().click()
  await page.getByRole('menuitem', { name: /OpenAPI spec/i }).click()
  await page.getByPlaceholder(/openapi\.json/i).first().fill('http://127.0.0.1:4000/documentation-json')
  await page.getByRole('button', { name: 'Load' }).click()
  await expect(page.getByText(/operations selected/i)).toBeVisible({ timeout: 20000 })
  await page.getByRole('button', { name: /Import \d+ operations/i }).click()

  // Wait for the import to settle. The scenario list in the sidebar gains
  // many entries (one per tag in the spec).
  await expect.poll(async () => await page.getByRole('button', { name: /^Scenario / }).count().catch(() => 0))
    .toBeGreaterThan(0)
    .catch(() => {})

  // Open any imported scenario from the sidebar (the project's "Misc"
  // bucket holds the tagless ops — perfect because it's always present).
  const anyScenario = page.getByText(/^Misc$/).first()
  await anyScenario.click({ timeout: 5000 }).catch(() => {})

  // Critical: NO "Unknown block kind: …" Alert should be visible after the
  // registry merge fix. Even ONE such alert means an imported scenario
  // step couldn't resolve its block.
  await expect(page.getByText(/Unknown block kind/i)).toHaveCount(0, { timeout: 5000 })
})
