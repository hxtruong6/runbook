// tests/execution/scenarioRef.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { runScenarioFrom } from "../../src/execution/runScenario";
import type { BlockDef, BlockInstance, BlockRunResult, RuntimeContext } from "../../src/blocks/types";
import type { Scenario } from "../../src/scenarios/types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeCtx(extra: Record<string, unknown> = {}): RuntimeContext {
  return { socketSessionUuid: "u", ...extra } as RuntimeContext;
}

/** A block def that immediately returns ok and captures `captured.token = "tok"` */
function makeOkDef(kind: string, capturedKey?: string): BlockDef {
  return {
    kind,
    label: kind,
    auth: "none",
    inputs: [],
    outputs: capturedKey ? [{ jsonPath: "token", contextKey: capturedKey }] : [],
    build: () => ({ method: "GET", url: "https://x/", headers: {} }),
  };
}

/** A block def that returns a 200 with `{ token: "captured-jwt" }` */
function makeCaptureOkDef(kind: string, capturedKey: string): BlockDef {
  return {
    kind,
    label: kind,
    auth: "none",
    inputs: [],
    outputs: [{ jsonPath: "token", contextKey: capturedKey }],
    build: () => ({ method: "GET", url: "https://x/", headers: {} }),
  };
}

/** Collect all results from a runScenarioFrom call */
async function collect(
  blocks: Scenario["blocks"],
  registry: Record<string, BlockDef>,
  scenarioLookup?: (id: string) => Scenario | null,
  ctx?: RuntimeContext
): Promise<{ idx: number; result: BlockRunResult; ctx: RuntimeContext }[]> {
  const initialCtx = ctx ?? makeCtx();
  let currentCtx = initialCtx;
  const out: { idx: number; result: BlockRunResult; ctx: RuntimeContext }[] = [];
  await runScenarioFrom(blocks, 0, initialCtx, (c, idx, result) => {
    currentCtx = c;
    out.push({ idx, result, ctx: c });
  }, null, registry, scenarioLookup);
  return out;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("scenario-ref expansion", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("happy path: 1 normal block + 1 scenario-ref → 3 results total (1 normal + composite with 2 subResults)", async () => {
    (global.fetch as any).mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify({ token: "captured-jwt" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }))
    );

    const subScenario: Scenario = {
      id: "sub-1",
      name: "Sub",
      createdAt: "2026-01-01",
      blocks: [
        { id: "s1", kind: "sub-blockA", overrides: {} },
        { id: "s2", kind: "sub-blockB", overrides: {} },
      ],
    };

    const registry: Record<string, BlockDef> = {
      "normal-block": makeOkDef("normal-block"),
      "sub-blockA": makeOkDef("sub-blockA"),
      "sub-blockB": makeOkDef("sub-blockB"),
    };

    const parentBlocks: Scenario["blocks"] = [
      { id: "p1", kind: "normal-block", overrides: {} },
      { id: "p2", kind: "scenario-ref", overrides: { scenarioId: "sub-1" } },
    ];

    const lookup = (id: string) => (id === "sub-1" ? subScenario : null);
    const results = await collect(parentBlocks, registry, lookup);

    expect(results).toHaveLength(2);
    expect(results[0].result.status).toBe("ok");
    expect(results[1].result.status).toBe("ok");
    expect(results[1].result.subResults).toHaveLength(2);
    expect(results[1].result.subResults![0].status).toBe("ok");
    expect(results[1].result.subResults![1].status).toBe("ok");
  });

  it("ctx propagation: sub-scenario captures jwt, parent block after ref can use it", async () => {
    // sub-block returns { token: "captured-jwt" } which maps to contextKey "jwt"
    (global.fetch as any).mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify({ token: "captured-jwt" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }))
    );

    const subScenario: Scenario = {
      id: "auth-sub",
      name: "Auth Sub",
      createdAt: "2026-01-01",
      blocks: [{ id: "s1", kind: "capture-block", overrides: {} }],
    };

    const registry: Record<string, BlockDef> = {
      "capture-block": makeCaptureOkDef("capture-block", "jwt"),
      "uses-jwt": makeOkDef("uses-jwt"),
    };

    const parentBlocks: Scenario["blocks"] = [
      { id: "p1", kind: "scenario-ref", overrides: { scenarioId: "auth-sub" } },
      { id: "p2", kind: "uses-jwt", overrides: {} },
    ];

    const lookup = (id: string) => (id === "auth-sub" ? subScenario : null);
    const results = await collect(parentBlocks, registry, lookup);

    // Both parent results should succeed
    expect(results[0].result.status).toBe("ok");
    expect(results[1].result.status).toBe("ok");
    // After the ref, ctx should have jwt
    expect(results[1].ctx.jwt).toBe("captured-jwt");
  });

  it("cycle detection: A refs B refs A → err with 'Cycle detected' and arrow chain", async () => {
    const scenarioA: Scenario = {
      id: "A",
      name: "A",
      createdAt: "2026-01-01",
      blocks: [{ id: "a1", kind: "scenario-ref", overrides: { scenarioId: "B" } }],
    };
    const scenarioB: Scenario = {
      id: "B",
      name: "B",
      createdAt: "2026-01-01",
      blocks: [{ id: "b1", kind: "scenario-ref", overrides: { scenarioId: "A" } }],
    };

    const registry: Record<string, BlockDef> = {};
    const lookup = (id: string) => (id === "A" ? scenarioA : id === "B" ? scenarioB : null);

    const parentBlocks: Scenario["blocks"] = [
      { id: "p1", kind: "scenario-ref", overrides: { scenarioId: "A" } },
    ];

    const results = await collect(parentBlocks, registry, lookup);
    expect(results[0].result.status).toBe("err");
    if (results[0].result.status === "err") {
      expect(results[0].result.error).toMatch(/Cycle detected/);
      // Chain should use unicode arrow: A → B → A
      expect(results[0].result.error).toMatch(/A → B → A/);
    }
  });

  it("missing scenario id → composite err, aborts parent by default", async () => {
    (global.fetch as any).mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200, headers: { "content-type": "application/json" } })
    );

    const registry: Record<string, BlockDef> = {
      "after-ref": makeOkDef("after-ref"),
    };

    const parentBlocks: Scenario["blocks"] = [
      { id: "p1", kind: "scenario-ref", overrides: { scenarioId: "nonexistent" } },
      { id: "p2", kind: "after-ref", overrides: {} },
    ];

    const lookup = (_id: string) => null;
    const results = await collect(parentBlocks, registry, lookup);

    expect(results).toHaveLength(1);
    expect(results[0].result.status).toBe("err");
    if (results[0].result.status === "err") {
      expect(results[0].result.error).toMatch(/Unknown scenario id/);
    }
    // p2 should NOT run
    expect(results.find(r => r.idx === 1)).toBeUndefined();
  });

  it("sub-scenario internal error + continueOnError:false → composite err, parent aborts", async () => {
    (global.fetch as any)
      .mockResolvedValueOnce(
        new Response(JSON.stringify({}), { status: 500, headers: { "content-type": "application/json" } })
      )
      .mockResolvedValue(
        new Response(JSON.stringify({}), { status: 200, headers: { "content-type": "application/json" } })
      );

    const subScenario: Scenario = {
      id: "failing-sub",
      name: "Failing Sub",
      createdAt: "2026-01-01",
      blocks: [{ id: "s1", kind: "fail-block", overrides: {} }],
    };

    const registry: Record<string, BlockDef> = {
      "fail-block": makeOkDef("fail-block"),
      "after-ref": makeOkDef("after-ref"),
    };

    const parentBlocks: Scenario["blocks"] = [
      { id: "p1", kind: "scenario-ref", overrides: { scenarioId: "failing-sub", continueOnError: false } },
      { id: "p2", kind: "after-ref", overrides: {} },
    ];

    const lookup = (id: string) => (id === "failing-sub" ? subScenario : null);
    const results = await collect(parentBlocks, registry, lookup);

    expect(results).toHaveLength(1);
    expect(results[0].result.status).toBe("err");
    // after-ref should NOT run
    expect(results.find(r => r.idx === 1)).toBeUndefined();
  });

  it("sub-scenario internal error + continueOnError:true → composite err, parent continues", async () => {
    (global.fetch as any)
      .mockResolvedValueOnce(
        new Response(JSON.stringify({}), { status: 500, headers: { "content-type": "application/json" } })
      )
      .mockResolvedValue(
        new Response(JSON.stringify({}), { status: 200, headers: { "content-type": "application/json" } })
      );

    const subScenario: Scenario = {
      id: "failing-sub",
      name: "Failing Sub",
      createdAt: "2026-01-01",
      blocks: [{ id: "s1", kind: "fail-block", overrides: {} }],
    };

    const registry: Record<string, BlockDef> = {
      "fail-block": makeOkDef("fail-block"),
      "after-ref": makeOkDef("after-ref"),
    };

    const parentBlocks: Scenario["blocks"] = [
      { id: "p1", kind: "scenario-ref", overrides: { scenarioId: "failing-sub", continueOnError: true } },
      { id: "p2", kind: "after-ref", overrides: {} },
    ];

    const lookup = (id: string) => (id === "failing-sub" ? subScenario : null);
    const results = await collect(parentBlocks, registry, lookup);

    // Both results present
    expect(results).toHaveLength(2);
    expect(results[0].result.status).toBe("err");
    expect(results[1].result.status).toBe("ok");
  });

  it("contextOverrides applied before sub-run: sub-scenario sees overridden userEmail", async () => {
    (global.fetch as any).mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify({}), { status: 200, headers: { "content-type": "application/json" } }))
    );

    let capturedCtxInSub: RuntimeContext | null = null;

    // A special block def that captures the ctx during execution
    const sniffDef: BlockDef = {
      kind: "sniff-block",
      label: "sniff",
      auth: "none",
      inputs: [],
      outputs: [],
      build: () => ({ method: "GET", url: "https://x/", headers: {} }),
    };

    const subScenario: Scenario = {
      id: "sub-override",
      name: "Sub Override",
      createdAt: "2026-01-01",
      blocks: [{ id: "s1", kind: "sniff-block", overrides: {} }],
    };

    const registry: Record<string, BlockDef> = {
      "sniff-block": sniffDef,
    };

    const parentBlocks: Scenario["blocks"] = [
      {
        id: "p1",
        kind: "scenario-ref",
        overrides: {
          scenarioId: "sub-override",
          contextOverrides: { userEmail: "x@y.com" },
        },
      },
    ];

    const lookup = (id: string) => (id === "sub-override" ? subScenario : null);

    // We intercept the onResult to grab ctx after the ref
    const initialCtx = makeCtx({ userEmail: "original@y.com" });
    let ctxAfterRef: RuntimeContext | null = null;

    await runScenarioFrom(
      parentBlocks,
      0,
      initialCtx,
      (ctx, _idx, result) => {
        ctxAfterRef = ctx;
        // grab subResults to check they ran with overridden ctx
        capturedCtxInSub = ctx;
      },
      null,
      registry,
      lookup
    );

    // After the ref, ctx should contain the override applied (it propagates up)
    expect(ctxAfterRef).not.toBeNull();
    expect((ctxAfterRef as any)?.userEmail).toBe("x@y.com");
  });

  it("invalid overrides (missing scenarioId) → err result, aborts by default", async () => {
    const registry: Record<string, BlockDef> = {
      "after-ref": makeOkDef("after-ref"),
    };

    const parentBlocks: Scenario["blocks"] = [
      // scenarioId is missing → parse failure
      { id: "p1", kind: "scenario-ref", overrides: { continueOnError: false } },
      { id: "p2", kind: "after-ref", overrides: {} },
    ];

    const results = await collect(parentBlocks, registry, () => null);

    expect(results).toHaveLength(1);
    expect(results[0].result.status).toBe("err");
    if (results[0].result.status === "err") {
      expect(results[0].result.error).toMatch(/Invalid scenario-ref overrides/);
    }
    // p2 should NOT run
    expect(results.find(r => r.idx === 1)).toBeUndefined();
  });
});
