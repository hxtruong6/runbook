// packages/cli/tests/diff.test.ts
import { describe, it, expect } from 'vitest'
import {
  bundleDiffToMarkdown,
  versionToMarkdown,
  changeEntryToMarkdown,
  type BundleLike,
  type VersionSummary,
} from '../../shared/src/diff/markdown.js'

const baseVersion: VersionSummary = {
  version: '1.0.0',
  releasedAt: '2025-01-01T00:00:00.000Z',
  releaseNotes: 'First release',
  changes: [
    { type: 'added', summary: 'Initial scaffold' },
  ],
}

const nextVersion: VersionSummary = {
  version: '1.1.0',
  releasedAt: '2025-06-01T00:00:00.000Z',
  releaseNotes: 'New blocks',
  changes: [
    { type: 'added', target: 'createOrder', summary: 'Add create-order block', breaking: false },
    { type: 'modified', target: 'getUser', summary: 'Changed response shape', breaking: true },
  ],
}

const prevBundle: BundleLike = {
  id: 'my-api',
  name: 'My API',
  description: 'Initial',
  versions: [baseVersion],
}

const nextBundle: BundleLike = {
  id: 'my-api',
  name: 'My API',
  description: 'Updated',
  versions: [baseVersion, nextVersion],
}

// ---------------------------------------------------------------------------
describe('changeEntryToMarkdown', () => {
  it('renders a simple entry', () => {
    const md = changeEntryToMarkdown({ type: 'added', summary: 'New block' })
    expect(md).toContain('🆕')
    expect(md).toContain('New block')
  })

  it('renders BREAKING flag', () => {
    const md = changeEntryToMarkdown({ type: 'modified', summary: 'Changed API', breaking: true })
    expect(md).toContain('**[BREAKING]**')
  })

  it('renders target in backticks', () => {
    const md = changeEntryToMarkdown({ type: 'removed', target: 'oldBlock', summary: 'Removed' })
    expect(md).toContain('`oldBlock`')
  })

  it('renders removeBy note', () => {
    const md = changeEntryToMarkdown({
      type: 'deprecated',
      summary: 'Will be gone',
      removeBy: 'v2.0.0',
    })
    expect(md).toContain('remove by v2.0.0')
  })
})

describe('versionToMarkdown', () => {
  it('includes version heading', () => {
    const md = versionToMarkdown(baseVersion)
    expect(md).toContain('### v1.0.0')
  })

  it('includes release notes', () => {
    const md = versionToMarkdown(baseVersion)
    expect(md).toContain('First release')
  })

  it('includes change entries', () => {
    const md = versionToMarkdown(nextVersion)
    expect(md).toContain('createOrder')
    expect(md).toContain('getUser')
  })
})

describe('bundleDiffToMarkdown', () => {
  it('includes bundle name in heading', () => {
    const md = bundleDiffToMarkdown(prevBundle, nextBundle)
    expect(md).toContain('My API')
  })

  it('shows new version as added', () => {
    const md = bundleDiffToMarkdown(prevBundle, nextBundle)
    expect(md).toContain('### v1.1.0')
  })

  it('does not show existing version as added', () => {
    const md = bundleDiffToMarkdown(prevBundle, nextBundle)
    // v1.0.0 is in both — should NOT appear under "New versions"
    const newSection = md.split('### Removed versions')[0]
    expect(newSection.split('### v1.0.0').length).toBe(1) // not present under New versions
  })

  it('shows removed version', () => {
    const removedBundle: BundleLike = { ...nextBundle, versions: [nextVersion] }
    const md = bundleDiffToMarkdown(nextBundle, removedBundle)
    expect(md).toContain('Removed versions')
    expect(md).toContain('v1.0.0')
  })

  it('reports no changes when bundles are identical', () => {
    const md = bundleDiffToMarkdown(prevBundle, prevBundle)
    expect(md).toContain('No version changes detected')
  })

  it('reports name change', () => {
    const renamed: BundleLike = { ...nextBundle, name: 'Renamed API' }
    const md = bundleDiffToMarkdown(prevBundle, renamed)
    expect(md).toContain('Name changed')
  })

  it('returns a string ending with newline', () => {
    const md = bundleDiffToMarkdown(prevBundle, nextBundle)
    expect(md.endsWith('\n')).toBe(true)
  })
})
