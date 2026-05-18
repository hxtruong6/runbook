// Diff two block sets across versions of the same project, so the user can
// see what the new OpenAPI re-import will add, remove, or change before
// they commit to it. We diff by `kind` because that's the stable identity
// of an API operation in this codebase.

import type { BlockDefData } from '../blocks/dataBlock'
import type { Scenario } from '../scenarios/types'

export interface BlockDiff {
  added: BlockDefData[]
  removed: BlockDefData[]
  changed: { kind: string; old: BlockDefData; next: BlockDefData; reasons: string[] }[]
  unchanged: number
}

function requestSignature(b: BlockDefData): string {
  const { method, urlTemplate } = b.request
  return `${method} ${urlTemplate}`
}

function changeReasons(prev: BlockDefData, next: BlockDefData): string[] {
  const reasons: string[] = []
  if (prev.request.method !== next.request.method) {
    reasons.push(`method ${prev.request.method} → ${next.request.method}`)
  }
  if (prev.request.urlTemplate !== next.request.urlTemplate) {
    reasons.push('url template changed')
  }
  const oldInputs = new Set((prev.inputs ?? []).map((i) => i.name))
  const newInputs = new Set((next.inputs ?? []).map((i) => i.name))
  const addedInputs = [...newInputs].filter((k) => !oldInputs.has(k))
  const removedInputs = [...oldInputs].filter((k) => !newInputs.has(k))
  if (addedInputs.length) reasons.push(`+${addedInputs.length} input${addedInputs.length === 1 ? '' : 's'}`)
  if (removedInputs.length) reasons.push(`-${removedInputs.length} input${removedInputs.length === 1 ? '' : 's'}`)
  return reasons
}

export function computeBlockDiff(prev: BlockDefData[], next: BlockDefData[]): BlockDiff {
  const prevByKind = new Map(prev.map((b) => [b.kind, b]))
  const nextByKind = new Map(next.map((b) => [b.kind, b]))

  const added = next.filter((b) => !prevByKind.has(b.kind))
  const removed = prev.filter((b) => !nextByKind.has(b.kind))

  const changed: BlockDiff['changed'] = []
  let unchanged = 0
  for (const nb of next) {
    const pb = prevByKind.get(nb.kind)
    if (!pb) continue
    if (requestSignature(pb) === requestSignature(nb)) {
      const reasons = changeReasons(pb, nb)
      if (reasons.length === 0) {
        unchanged++
      } else {
        changed.push({ kind: nb.kind, old: pb, next: nb, reasons })
      }
    } else {
      changed.push({ kind: nb.kind, old: pb, next: nb, reasons: changeReasons(pb, nb) })
    }
  }
  return { added, removed, changed, unchanged }
}

export interface AffectedScenario {
  id: string
  name: string
  orphanedKinds: string[]
}

export function affectedScenarios(scenarios: Scenario[], removedKinds: Set<string>): AffectedScenario[] {
  if (removedKinds.size === 0) return []
  const out: AffectedScenario[] = []
  for (const s of scenarios) {
    const orphans = s.blocks.filter((b) => removedKinds.has(b.kind)).map((b) => b.kind)
    if (orphans.length > 0) {
      out.push({ id: s.id, name: s.name, orphanedKinds: [...new Set(orphans)] })
    }
  }
  return out
}

/** Suggest the next version string (1.0.0 → 1.0.1) given existing version
 *  strings. Patch-bumps the latest by semver order. Tolerates a leading "v"
 *  on input and preserves it on output. If a part can't be parsed, the next
 *  string is "<latest>-2" to avoid colliding. */
export function suggestNextVersion(existing: string[]): string {
  if (existing.length === 0) return '1.0.0'
  const stripV = (s: string) => (s.startsWith('v') || s.startsWith('V') ? s.slice(1) : s)
  const sorted = [...existing].sort((a, b) => {
    const pa = stripV(a).split('.').map((p) => parseInt(p, 10) || 0)
    const pb = stripV(b).split('.').map((p) => parseInt(p, 10) || 0)
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      const d = (pb[i] ?? 0) - (pa[i] ?? 0)
      if (d !== 0) return d
    }
    return 0
  })
  const latest = sorted[0]
  const hasVPrefix = latest.startsWith('v') || latest.startsWith('V')
  const core = stripV(latest)
  const parts = core.split('.').map((p) => parseInt(p, 10))
  if (parts.length === 0 || parts.some((n) => Number.isNaN(n))) return `${latest}-2`
  parts[parts.length - 1] = (parts[parts.length - 1] ?? 0) + 1
  const next = parts.join('.')
  return hasVPrefix ? `v${next}` : next
}
