import { createHash } from 'node:crypto'

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value as object)
        .sort()
        .map((k) => [k, sortKeys((value as Record<string, unknown>)[k])])
    )
  }
  return value
}

export function computeBundleHash(bundle: unknown): string {
  const canonical = JSON.stringify(sortKeys(bundle))
  return createHash('sha256').update(canonical).digest('hex')
}

export function verifyBundleHash(bundle: unknown, hash: string): boolean {
  return computeBundleHash(bundle) === hash
}
