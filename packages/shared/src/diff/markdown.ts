// packages/shared/src/diff/markdown.ts
// Reusable markdown serialisation for bundle change-lists.
// Used by the CLI `runbook diff` command and the GitHub PR diff workflow.

export type ChangeType = 'added' | 'modified' | 'deprecated' | 'removed' | 'fixed' | 'note'

export interface ChangeEntry {
  type: ChangeType
  target?: string
  summary: string
  breaking?: boolean
  removeBy?: string
}

export interface VersionSummary {
  version: string
  releasedAt: string
  releaseNotes: string
  changes: ChangeEntry[]
}

/** Map each ChangeType to a Markdown emoji prefix. */
const TYPE_EMOJI: Record<ChangeType, string> = {
  added: '🆕',
  modified: '✏️',
  deprecated: '⚠️',
  removed: '🗑️',
  fixed: '🐛',
  note: '📝',
}

/** Render a single ChangeEntry as a Markdown list item. */
export function changeEntryToMarkdown(entry: ChangeEntry): string {
  const emoji = TYPE_EMOJI[entry.type] ?? '•'
  const breaking = entry.breaking ? ' **[BREAKING]**' : ''
  const target = entry.target ? ` \`${entry.target}\`` : ''
  const removeBy = entry.removeBy ? ` _(remove by ${entry.removeBy})_` : ''
  return `- ${emoji}${breaking}${target} ${entry.summary}${removeBy}`
}

/** Render a full version's change-list as Markdown. */
export function versionToMarkdown(v: VersionSummary): string {
  const lines: string[] = []
  lines.push(`### v${v.version} — ${v.releasedAt.slice(0, 10)}`)
  if (v.releaseNotes) {
    lines.push('')
    lines.push(v.releaseNotes)
  }
  if (v.changes.length > 0) {
    lines.push('')
    for (const entry of v.changes) {
      lines.push(changeEntryToMarkdown(entry))
    }
  }
  return lines.join('\n')
}

/**
 * Produce a human-readable Markdown diff between two bundles.
 *
 * The function compares:
 * - Bundle metadata (name, description)
 * - Versions present in `next` that are absent in `prev` (added versions)
 * - Versions present in both, comparing their change entries
 * - Versions dropped from `next` (removed versions)
 */
export interface BundleLike {
  id: string
  name: string
  description?: string
  versions: VersionSummary[]
}

export function bundleDiffToMarkdown(prev: BundleLike, next: BundleLike): string {
  const lines: string[] = []

  lines.push(`## Runbook Bundle Diff: \`${next.name}\``)
  lines.push('')

  if (prev.name !== next.name) {
    lines.push(`> **Name changed:** \`${prev.name}\` → \`${next.name}\``)
    lines.push('')
  }
  if ((prev.description ?? '') !== (next.description ?? '')) {
    lines.push(`> **Description changed**`)
    lines.push(`> - Before: ${prev.description ?? '_(none)_'}`)
    lines.push(`> - After:  ${next.description ?? '_(none)_'}`)
    lines.push('')
  }

  const prevVersions = new Map(prev.versions.map((v) => [v.version, v]))
  const nextVersions = new Map(next.versions.map((v) => [v.version, v]))

  const added = next.versions.filter((v) => !prevVersions.has(v.version))
  const removed = prev.versions.filter((v) => !nextVersions.has(v.version))

  if (added.length > 0) {
    lines.push('### New versions')
    lines.push('')
    for (const v of added) {
      lines.push(versionToMarkdown(v))
      lines.push('')
    }
  }

  if (removed.length > 0) {
    lines.push('### Removed versions')
    lines.push('')
    for (const v of removed) {
      lines.push(`- \`v${v.version}\` (released ${v.releasedAt.slice(0, 10)})`)
    }
    lines.push('')
  }

  if (added.length === 0 && removed.length === 0) {
    lines.push('_No version changes detected._')
    lines.push('')
  }

  return lines.join('\n').trimEnd() + '\n'
}
