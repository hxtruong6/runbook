import { describe, it, expect } from "vitest";
import { BurstOptionsSchema, makeBurstSummary } from "../../src/execution/burst";
import type { BurstRunResult, BurstOptions } from "../../src/execution/burst";

// ---------------------------------------------------------------------------
// Schema validation
// ---------------------------------------------------------------------------

describe("BurstOptionsSchema", () => {
  const validOpts = {
    count: 10,
    windowMs: 1000,
    concurrency: "parallel" as const,
    freshContext: true,
  };

  it("parses valid options", () => {
    const result = BurstOptionsSchema.safeParse(validOpts);
    expect(result.success).toBe(true);
  });

  it("parses sequential concurrency", () => {
    const result = BurstOptionsSchema.safeParse({ ...validOpts, concurrency: "sequential" });
    expect(result.success).toBe(true);
  });

  it("rejects count = 0", () => {
    const result = BurstOptionsSchema.safeParse({ ...validOpts, count: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects count = 201", () => {
    const result = BurstOptionsSchema.safeParse({ ...validOpts, count: 201 });
    expect(result.success).toBe(false);
  });

  it("rejects windowMs = 49", () => {
    const result = BurstOptionsSchema.safeParse({ ...validOpts, windowMs: 49 });
    expect(result.success).toBe(false);
  });

  it("rejects windowMs = 60001", () => {
    const result = BurstOptionsSchema.safeParse({ ...validOpts, windowMs: 60_001 });
    expect(result.success).toBe(false);
  });

  it("rejects unknown concurrency value", () => {
    const result = BurstOptionsSchema.safeParse({ ...validOpts, concurrency: "ramp-up" });
    expect(result.success).toBe(false);
  });

  it("allows count = 1 (boundary min)", () => {
    expect(BurstOptionsSchema.safeParse({ ...validOpts, count: 1 }).success).toBe(true);
  });

  it("allows count = 200 (boundary max)", () => {
    expect(BurstOptionsSchema.safeParse({ ...validOpts, count: 200 }).success).toBe(true);
  });

  it("allows windowMs = 50 (boundary min)", () => {
    expect(BurstOptionsSchema.safeParse({ ...validOpts, windowMs: 50 }).success).toBe(true);
  });

  it("allows windowMs = 60000 (boundary max)", () => {
    expect(BurstOptionsSchema.safeParse({ ...validOpts, windowMs: 60_000 }).success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// makeBurstSummary
// ---------------------------------------------------------------------------

const baseOptions: BurstOptions = {
  count: 5,
  windowMs: 1000,
  concurrency: "sequential",
  freshContext: true,
};

function makeRun(
  idx: number,
  status: "ok" | "err",
  elapsedMs: number,
  error?: string,
): BurstRunResult {
  return {
    runIdx: idx,
    startedAt: idx * 100,
    elapsedMs,
    status,
    error,
    blockResults: [],
  };
}

describe("makeBurstSummary", () => {
  it("computes okCount and errCount correctly", () => {
    const runs: BurstRunResult[] = [
      makeRun(0, "ok", 100),
      makeRun(1, "err", 200, "timeout"),
      makeRun(2, "ok", 150),
      makeRun(3, "err", 300, "timeout"),
      makeRun(4, "ok", 120),
    ];
    const summary = makeBurstSummary(baseOptions, runs, 1000);
    expect(summary.okCount).toBe(3);
    expect(summary.errCount).toBe(2);
  });

  it("groups errors by message and sorts by count desc", () => {
    const runs: BurstRunResult[] = [
      makeRun(0, "err", 100, "network error"),
      makeRun(1, "err", 110, "timeout"),
      makeRun(2, "err", 120, "timeout"),
      makeRun(3, "err", 130, "network error"),
      makeRun(4, "err", 140, "network error"),
    ];
    const summary = makeBurstSummary(baseOptions, runs, 1000);
    expect(summary.errorGroups).toEqual([
      { message: "network error", count: 3 },
      { message: "timeout", count: 2 },
    ]);
  });

  it("ties in error count preserve first-seen order", () => {
    // "alpha" appears first, "beta" second — both count 2
    const runs: BurstRunResult[] = [
      makeRun(0, "err", 100, "alpha"),
      makeRun(1, "err", 110, "beta"),
      makeRun(2, "err", 120, "alpha"),
      makeRun(3, "err", 130, "beta"),
    ];
    const summary = makeBurstSummary(baseOptions, runs, 800);
    // Both have count 2; "alpha" was first-seen so should appear first
    expect(summary.errorGroups[0].message).toBe("alpha");
    expect(summary.errorGroups[1].message).toBe("beta");
  });

  it("empty runs → zeroed latencies, empty errorGroups, ok+err = 0", () => {
    const summary = makeBurstSummary(baseOptions, [], 0);
    expect(summary.okCount).toBe(0);
    expect(summary.errCount).toBe(0);
    expect(summary.errorGroups).toEqual([]);
    expect(summary.latencies).toEqual({ min: 0, p50: 0, p95: 0, max: 0, mean: 0 });
  });

  it("preserves options and totalElapsedMs verbatim", () => {
    const runs = [makeRun(0, "ok", 50)];
    const summary = makeBurstSummary(baseOptions, runs, 9999);
    expect(summary.options).toBe(baseOptions);
    expect(summary.totalElapsedMs).toBe(9999);
  });

  it("computes latencies from run elapsedMs values", () => {
    const runs = [
      makeRun(0, "ok", 10),
      makeRun(1, "ok", 20),
      makeRun(2, "ok", 30),
    ];
    const summary = makeBurstSummary(baseOptions, runs, 100);
    expect(summary.latencies.min).toBe(10);
    expect(summary.latencies.max).toBe(30);
    expect(summary.latencies.mean).toBe(20);
  });

  it("err runs without an error string are not counted in errorGroups", () => {
    const runs: BurstRunResult[] = [
      { runIdx: 0, startedAt: 0, elapsedMs: 50, status: "err", blockResults: [] },
    ];
    const summary = makeBurstSummary(baseOptions, runs, 50);
    expect(summary.errCount).toBe(1);
    expect(summary.errorGroups).toEqual([]);
  });
});
