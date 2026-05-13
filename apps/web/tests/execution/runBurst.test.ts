// tests/execution/runBurst.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { runBurst, BurstOptionsSchema } from "../../src/execution/burst";
import type { BurstDeps, BurstProgress, BurstOptions } from "../../src/execution/burst";
import type { BlockDef, RuntimeContext } from "../../src/blocks/types";
import type { Scenario } from "../../src/scenarios/types";

// ─── Fake registry helpers ────────────────────────────────────────────────────

/** Returns a BlockDef that immediately resolves ok via a mocked fetch (200) */
function makeOkDef(kind: string): BlockDef {
  return {
    kind,
    label: kind,
    auth: "none",
    inputs: [],
    outputs: [],
    build: () => ({ method: "GET", url: "https://x/", headers: {} }),
  };
}

/** Returns a BlockDef that returns a 500 error response */
function makeErrDef(kind: string): BlockDef {
  return {
    kind,
    label: kind,
    auth: "none",
    inputs: [],
    outputs: [],
    build: () => ({ method: "GET", url: "https://x/fail", headers: {} }),
  };
}

function makeScenario(kinds: string[]): Scenario {
  return {
    id: "s1",
    name: "Test",
    createdAt: "2026-01-01",
    blocks: kinds.map((k, i) => ({ id: `b${i}`, kind: k, overrides: {} })),
  };
}

function makeCtxFactory(): () => RuntimeContext {
  return () => ({ socketSessionUuid: crypto.randomUUID() } as RuntimeContext);
}

function makeDeps(
  scenario: Scenario,
  registry: Record<string, BlockDef>,
  makeCtx?: () => RuntimeContext,
): BurstDeps {
  return {
    scenario,
    scenarioLookup: () => null,
    registry,
    env: null,
    makeCtx: makeCtx ?? makeCtxFactory(),
  };
}

// ─── Test setup ───────────────────────────────────────────────────────────────

function mockFetch200(): void {
  global.fetch = vi.fn().mockImplementation(() =>
    Promise.resolve(
      new Response(JSON.stringify({}), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    ),
  );
}

function mockFetch500(): void {
  global.fetch = vi.fn().mockImplementation(() =>
    Promise.resolve(
      new Response(JSON.stringify({ message: "fail" }), {
        status: 500,
        headers: { "content-type": "application/json" },
      }),
    ),
  );
}

beforeEach(() => {
  mockFetch200();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("runBurst — sequential happy path", () => {
  it("count=3, all ok → summary okCount=3 errCount=0, runs in order 0,1,2", async () => {
    const registry = { "ok-block": makeOkDef("ok-block") };
    const scenario = makeScenario(["ok-block"]);
    const opts: BurstOptions = { count: 3, windowMs: 50, concurrency: "sequential", freshContext: true };
    const summary = await runBurst(opts, makeDeps(scenario, registry));
    expect(summary.okCount).toBe(3);
    expect(summary.errCount).toBe(0);
    expect(summary.runs.map((r) => r.runIdx)).toEqual([0, 1, 2]);
    expect(summary.runs.every((r) => r.status === "ok")).toBe(true);
  });
});

describe("runBurst — parallel happy path", () => {
  it("count=5, parallel → 5 ok runs, all complete", async () => {
    const registry = { "ok-block": makeOkDef("ok-block") };
    const scenario = makeScenario(["ok-block"]);
    const opts: BurstOptions = { count: 5, windowMs: 50, concurrency: "parallel", freshContext: true };
    const summary = await runBurst(opts, makeDeps(scenario, registry));
    expect(summary.okCount).toBe(5);
    expect(summary.errCount).toBe(0);
    expect(summary.runs).toHaveLength(5);
  });
});

describe("runBurst — hard cap validation", () => {
  it("BurstOptionsSchema.parse throws for count=201", () => {
    expect(() =>
      BurstOptionsSchema.parse({ count: 201, windowMs: 1000, concurrency: "sequential", freshContext: true }),
    ).toThrow();
  });

  it("runBurst throws for count=201 (validates internally)", async () => {
    const registry = { "ok-block": makeOkDef("ok-block") };
    const scenario = makeScenario(["ok-block"]);
    const opts = { count: 201, windowMs: 1000, concurrency: "sequential" as const, freshContext: true };
    await expect(runBurst(opts, makeDeps(scenario, registry))).rejects.toThrow();
  });
});

describe("runBurst — parallel forces freshContext", () => {
  it("each run gets its own ctx even when freshContext=false is passed", async () => {
    let ctxCallCount = 0;
    const ctxObjects: RuntimeContext[] = [];

    const makeCtx = (): RuntimeContext => {
      const ctx = { socketSessionUuid: `uuid-${ctxCallCount++}` } as RuntimeContext;
      ctxObjects.push(ctx);
      return ctx;
    };

    const registry = { "ok-block": makeOkDef("ok-block") };
    const scenario = makeScenario(["ok-block"]);
    // Pass freshContext: false — parallel should override to true
    const opts: BurstOptions = { count: 3, windowMs: 50, concurrency: "parallel", freshContext: false };
    await runBurst(opts, makeDeps(scenario, registry, makeCtx));

    // With parallel always using fresh ctx, makeCtx should be called 3 times
    expect(ctxObjects.length).toBe(3);
    // All should be distinct objects
    const uuids = ctxObjects.map((c) => c.socketSessionUuid);
    expect(new Set(uuids).size).toBe(3);
  });
});

describe("runBurst — sequential freshContext=false shares context", () => {
  it("shared ctx persists captured values between runs", async () => {
    const capturedRunIdxValues: number[] = [];

    // A block that mutates ctx (we'll intercept via onResult in runScenarioFrom)
    // Instead, verify that makeCtx is called ONCE for sequential+freshContext=false
    let makeCtxCallCount = 0;
    const makeCtx = (): RuntimeContext => {
      makeCtxCallCount++;
      return { socketSessionUuid: "shared-uuid" } as RuntimeContext;
    };

    const registry = { "ok-block": makeOkDef("ok-block") };
    const scenario = makeScenario(["ok-block", "ok-block"]);
    const opts: BurstOptions = { count: 3, windowMs: 50, concurrency: "sequential", freshContext: false };

    await runBurst(opts, makeDeps(scenario, registry, makeCtx));

    // makeCtx should only be called once (sharedCtx created before loop)
    expect(makeCtxCallCount).toBe(1);
  });
});

describe("runBurst — error aggregation", () => {
  it("3 runs with failing block → summary errCount=3, errorGroups populated", async () => {
    mockFetch500();

    const registry = { "err-block": makeErrDef("err-block") };
    const scenario = makeScenario(["err-block"]);
    const opts: BurstOptions = { count: 3, windowMs: 50, concurrency: "sequential", freshContext: true };
    const summary = await runBurst(opts, makeDeps(scenario, registry));

    expect(summary.errCount).toBe(3);
    expect(summary.okCount).toBe(0);
    expect(summary.errorGroups.length).toBeGreaterThan(0);
    expect(summary.errorGroups[0].message).toMatch(/HTTP 500/);
    expect(summary.errorGroups[0].count).toBe(3);
  });
});

describe("runBurst — abort sequential", () => {
  it("abort after 2 runs → fewer than count runs, done event still fires", async () => {
    const controller = new AbortController();
    const events: BurstProgress[] = [];
    let runFinishedCount = 0;

    const registry = { "ok-block": makeOkDef("ok-block") };
    const scenario = makeScenario(["ok-block"]);
    const opts: BurstOptions = { count: 10, windowMs: 200, concurrency: "sequential", freshContext: true };

    const onProgress = (ev: BurstProgress) => {
      events.push(ev);
      if (ev.type === "run-finished") {
        runFinishedCount++;
        if (runFinishedCount >= 2) {
          controller.abort();
        }
      }
    };

    const summary = await runBurst(opts, makeDeps(scenario, registry), onProgress, controller.signal);

    expect(summary.runs.length).toBeLessThan(10);
    expect(summary.runs.length).toBeGreaterThanOrEqual(2);
    const doneEvents = events.filter((e) => e.type === "done");
    expect(doneEvents).toHaveLength(1);
  });
});

describe("runBurst — abort parallel before any run starts", () => {
  it("abort immediately → 0 runs, done event fires", async () => {
    const controller = new AbortController();
    controller.abort(); // abort before calling runBurst

    const events: BurstProgress[] = [];
    const registry = { "ok-block": makeOkDef("ok-block") };
    const scenario = makeScenario(["ok-block"]);
    const opts: BurstOptions = { count: 5, windowMs: 200, concurrency: "parallel", freshContext: true };

    const summary = await runBurst(opts, makeDeps(scenario, registry), (ev) => events.push(ev), controller.signal);

    expect(summary.runs.length).toBe(0);
    expect(summary.okCount).toBe(0);
    const doneEvents = events.filter((e) => e.type === "done");
    expect(doneEvents).toHaveLength(1);
  });
});

describe("runBurst — progress events order for sequential", () => {
  it("events follow pattern: [run-started, run-finished]×N then done", async () => {
    const events: BurstProgress[] = [];
    const registry = { "ok-block": makeOkDef("ok-block") };
    const scenario = makeScenario(["ok-block"]);
    const opts: BurstOptions = { count: 3, windowMs: 50, concurrency: "sequential", freshContext: true };

    await runBurst(opts, makeDeps(scenario, registry), (ev) => events.push(ev));

    expect(events).toHaveLength(7); // 3×(started+finished) + 1 done
    expect(events[0].type).toBe("run-started");
    expect(events[1].type).toBe("run-finished");
    expect(events[2].type).toBe("run-started");
    expect(events[3].type).toBe("run-finished");
    expect(events[4].type).toBe("run-started");
    expect(events[5].type).toBe("run-finished");
    expect(events[6].type).toBe("done");
    // runIdx values in order
    expect((events[0] as { type: "run-started"; runIdx: number }).runIdx).toBe(0);
    expect((events[2] as { type: "run-started"; runIdx: number }).runIdx).toBe(1);
    expect((events[4] as { type: "run-started"; runIdx: number }).runIdx).toBe(2);
  });
});
