// src/execution/stats.ts

/**
 * Returns a map of percentile → interpolated value using the standard "type 7"
 * (inclusive / linear interpolation) method — same as numpy's default.
 *
 * @param values  Input array (not mutated).
 * @param ps      Percentiles to compute, each in [0, 100].
 * @returns       Record keyed by each value in `ps`, or {} if `values` is empty.
 */
export function percentiles(values: number[], ps: number[]): Record<number, number> {
  if (values.length === 0) return {};

  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const result: Record<number, number> = {};

  for (const p of ps) {
    // Type-7 (H&F): h = (n-1) * p/100
    const h = (n - 1) * (p / 100);
    const lo = Math.floor(h);
    const hi = Math.ceil(h);
    const frac = h - lo;
    result[p] = sorted[lo] + frac * (sorted[hi] - sorted[lo]);
  }

  return result;
}

export type LatencySummary = {
  min: number;
  p50: number;
  p95: number;
  max: number;
  mean: number;
};

/**
 * Convenience wrapper: returns min, p50, p95, max, mean for a latency array.
 * Empty array → all zeros.
 */
export function summarizeLatencies(values: number[]): LatencySummary {
  if (values.length === 0) {
    return { min: 0, p50: 0, p95: 0, max: 0, mean: 0 };
  }

  const ps = percentiles(values, [50, 95]);
  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((acc, v) => acc + v, 0) / values.length;

  return {
    min: sorted[0],
    p50: ps[50],
    p95: ps[95],
    max: sorted[sorted.length - 1],
    mean,
  };
}
