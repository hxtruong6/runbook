// src/projects/semver.ts
// Lightweight semver utilities — no external dependency needed.

function parse(version: string): number[] {
  return version.split(".").map((part) => parseInt(part, 10) || 0);
}

/** Returns negative if a > b (newest first), positive if a < b, 0 if equal. */
export function compareSemverDesc(a: string, b: string): number {
  const pa = parse(a);
  const pb = parse(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pb[i] ?? 0) - (pa[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/** Returns a new array sorted newest → oldest. */
export function sortVersionsDesc<T extends { version: string }>(versions: T[]): T[] {
  return [...versions].sort((a, b) => compareSemverDesc(a.version, b.version));
}
