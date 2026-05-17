// apps/web/tests/import/githubImport.test.ts
import { describe, it, expect } from 'vitest'
import { resolveRawUrl } from '../../src/features/import/GithubImport'

describe('resolveRawUrl', () => {
  // -------------------------------------------------------------------------
  // Already-raw URLs pass through unchanged
  // -------------------------------------------------------------------------
  it('returns raw.githubusercontent.com URLs unchanged', () => {
    const url = 'https://raw.githubusercontent.com/owner/repo/main/runbook.json'
    expect(resolveRawUrl(url)).toBe(url)
  })

  it('returns a raw URL with a subdirectory path unchanged', () => {
    const url = 'https://raw.githubusercontent.com/owner/repo/main/configs/runbook.json'
    expect(resolveRawUrl(url)).toBe(url)
  })

  // -------------------------------------------------------------------------
  // Root repo URL → default branch + runbook.json
  // -------------------------------------------------------------------------
  it('converts a root github.com repo URL to raw main/runbook.json', () => {
    expect(resolveRawUrl('https://github.com/owner/repo')).toBe(
      'https://raw.githubusercontent.com/owner/repo/main/runbook.json',
    )
  })

  it('handles trailing slash on root repo URL', () => {
    // URL parser strips trailing slash path is /owner/repo/
    expect(resolveRawUrl('https://github.com/owner/repo/')).toBe(
      'https://raw.githubusercontent.com/owner/repo/main/runbook.json',
    )
  })

  // -------------------------------------------------------------------------
  // /tree/branch URLs
  // -------------------------------------------------------------------------
  it('converts /tree/branch URL to raw branch/runbook.json', () => {
    expect(resolveRawUrl('https://github.com/owner/repo/tree/develop')).toBe(
      'https://raw.githubusercontent.com/owner/repo/develop/runbook.json',
    )
  })

  it('handles non-main branch name', () => {
    expect(resolveRawUrl('https://github.com/owner/repo/tree/feature/my-feat')).toBe(
      'https://raw.githubusercontent.com/owner/repo/feature/runbook.json',
    )
  })

  // -------------------------------------------------------------------------
  // /blob/branch/path URLs
  // -------------------------------------------------------------------------
  it('converts /blob URL to raw file URL', () => {
    expect(resolveRawUrl('https://github.com/owner/repo/blob/main/runbook.json')).toBe(
      'https://raw.githubusercontent.com/owner/repo/main/runbook.json',
    )
  })

  it('converts /blob URL with subdirectory path', () => {
    expect(
      resolveRawUrl('https://github.com/owner/repo/blob/main/configs/runbook.json'),
    ).toBe('https://raw.githubusercontent.com/owner/repo/main/configs/runbook.json')
  })

  // -------------------------------------------------------------------------
  // Non-GitHub URLs pass through unchanged
  // -------------------------------------------------------------------------
  it('returns non-GitHub https URLs unchanged', () => {
    const url = 'https://example.com/runbook.json'
    expect(resolveRawUrl(url)).toBe(url)
  })

  it('returns an arbitrary https URL unchanged', () => {
    const url = 'https://cdn.mycompany.io/api/bundle.json'
    expect(resolveRawUrl(url)).toBe(url)
  })

  // -------------------------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------------------------
  it('returns non-URL strings unchanged (will fail at fetch time)', () => {
    expect(resolveRawUrl('not-a-url')).toBe('not-a-url')
  })

  it('trims whitespace before processing', () => {
    const url = '  https://github.com/owner/repo  '
    expect(resolveRawUrl(url)).toBe(
      'https://raw.githubusercontent.com/owner/repo/main/runbook.json',
    )
  })
})
