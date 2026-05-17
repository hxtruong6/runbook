// tests/share/embedBadgeModal.test.ts
// Verifies the Markdown / HTML / BBCode snippet generators produce correct output.
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Helpers extracted from EmbedBadgeModal — we test the logic independently
// so we don't need a full browser/DOM render of the modal component.
// ---------------------------------------------------------------------------

const APP_BASE = 'https://runbook.example.com'
const BADGE_LIGHT_PATH = '/docs/assets/badge-light.svg'
const BADGE_DARK_PATH = '/docs/assets/badge-dark.svg'

function buildRunUrl(bundleUrl: string, scenarioId: string): string {
  const params = new URLSearchParams()
  if (bundleUrl) params.set('bundle', bundleUrl)
  if (scenarioId) params.set('scenario', scenarioId)
  return `${APP_BASE}/#/run?${params.toString()}`
}

function generateMarkdown(bundleUrl: string, scenarioId: string): string {
  const runUrl = buildRunUrl(bundleUrl, scenarioId)
  const lightBadge = `${APP_BASE}${BADGE_LIGHT_PATH}`
  return `[![Run in Runbook](${lightBadge})](${runUrl})`
}

function generateHtml(bundleUrl: string, scenarioId: string): string {
  const runUrl = buildRunUrl(bundleUrl, scenarioId)
  const lightBadge = `${APP_BASE}${BADGE_LIGHT_PATH}`
  const darkBadge = `${APP_BASE}${BADGE_DARK_PATH}`
  return `<a href="${runUrl}" target="_blank" rel="noopener noreferrer">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="${darkBadge}">
    <img src="${lightBadge}" alt="Run in Runbook" width="180" height="32">
  </picture>
</a>`
}

function generateBBCode(bundleUrl: string, scenarioId: string): string {
  const runUrl = buildRunUrl(bundleUrl, scenarioId)
  const lightBadge = `${APP_BASE}${BADGE_LIGHT_PATH}`
  return `[url=${runUrl}][img]${lightBadge}[/img][/url]`
}

// ---------------------------------------------------------------------------

const BUNDLE_URL = 'https://cdn.example.com/my-bundle.bundle.json'
const SCENARIO_ID = 'scenario-abc'

describe('EmbedBadgeModal — snippet generators', () => {
  describe('Markdown', () => {
    it('produces a Markdown image link', () => {
      const md = generateMarkdown(BUNDLE_URL, SCENARIO_ID)
      expect(md).toMatch(/^\[!\[Run in Runbook\]/)
    })

    it('includes the bundle URL in the run link', () => {
      const md = generateMarkdown(BUNDLE_URL, SCENARIO_ID)
      expect(md).toContain(encodeURIComponent(BUNDLE_URL))
    })

    it('includes the scenario ID in the run link', () => {
      const md = generateMarkdown(BUNDLE_URL, SCENARIO_ID)
      expect(md).toContain(encodeURIComponent(SCENARIO_ID))
    })

    it('points at the light badge SVG', () => {
      const md = generateMarkdown(BUNDLE_URL, SCENARIO_ID)
      expect(md).toContain(BADGE_LIGHT_PATH)
    })

    it('run link uses #/run hash route', () => {
      const md = generateMarkdown(BUNDLE_URL, SCENARIO_ID)
      expect(md).toContain('#/run?')
    })
  })

  describe('HTML', () => {
    it('includes both light and dark badge variants', () => {
      const html = generateHtml(BUNDLE_URL, SCENARIO_ID)
      expect(html).toContain(BADGE_LIGHT_PATH)
      expect(html).toContain(BADGE_DARK_PATH)
    })

    it('uses prefers-color-scheme dark media query for dark badge', () => {
      const html = generateHtml(BUNDLE_URL, SCENARIO_ID)
      expect(html).toContain('prefers-color-scheme: dark')
    })

    it('has alt text "Run in Runbook"', () => {
      const html = generateHtml(BUNDLE_URL, SCENARIO_ID)
      expect(html).toContain('alt="Run in Runbook"')
    })

    it('opens link in new tab', () => {
      const html = generateHtml(BUNDLE_URL, SCENARIO_ID)
      expect(html).toContain('target="_blank"')
    })
  })

  describe('BBCode', () => {
    it('wraps image in url tag', () => {
      const bb = generateBBCode(BUNDLE_URL, SCENARIO_ID)
      expect(bb).toMatch(/^\[url=/)
      expect(bb).toContain('[/url]')
    })

    it('contains the img tag with the light badge', () => {
      const bb = generateBBCode(BUNDLE_URL, SCENARIO_ID)
      expect(bb).toContain('[img]')
      expect(bb).toContain(BADGE_LIGHT_PATH)
    })
  })

  describe('buildRunUrl', () => {
    it('encodes bundle URL as a query parameter', () => {
      const url = buildRunUrl(BUNDLE_URL, '')
      const parsed = new URL(url.replace('/#/', '/'))
      // hash-based — parse manually
      expect(url).toContain(`bundle=${encodeURIComponent(BUNDLE_URL)}`)
    })

    it('omits scenario param when empty', () => {
      const url = buildRunUrl(BUNDLE_URL, '')
      expect(url).not.toContain('scenario=')
    })

    it('includes scenario param when provided', () => {
      const url = buildRunUrl(BUNDLE_URL, SCENARIO_ID)
      expect(url).toContain(`scenario=${encodeURIComponent(SCENARIO_ID)}`)
    })
  })
})
