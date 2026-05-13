// tests/execution/runScenario.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { resolveInputs, runBlock } from "../../src/execution/runScenario";
import type { BlockDef, BlockInstance, RuntimeContext } from "../../src/blocks/types";

const stubDef: BlockDef = {
  kind: "stub",
  label: "stub",
  auth: "none",
  inputs: [
    { name: "a", label: "a", type: "string", required: true, fromContextKey: "ctxA" },
    { name: "b", label: "b", type: "string" },
  ],
  outputs: [{ jsonPath: "out", contextKey: "outKey" }],
  build: (v) => ({ method: "POST", url: "https://x/", headers: {}, body: v }),
};

describe("resolveInputs", () => {
  it("override beats context", () => {
    const ctx: RuntimeContext = { socketSessionUuid: "u", ctxA: "from-ctx" };
    const inst: BlockInstance = { id: "1", kind: "stub", overrides: { a: "override" } };
    expect(resolveInputs(stubDef, inst, ctx)).toEqual({ a: "override" });
  });

  it("falls back to context when no override", () => {
    const ctx: RuntimeContext = { socketSessionUuid: "u", ctxA: "from-ctx" };
    const inst: BlockInstance = { id: "1", kind: "stub", overrides: {} };
    expect(resolveInputs(stubDef, inst, ctx)).toEqual({ a: "from-ctx" });
  });

  it("omits fields with no value", () => {
    const ctx: RuntimeContext = { socketSessionUuid: "u" };
    const inst: BlockInstance = { id: "1", kind: "stub", overrides: {} };
    expect(resolveInputs(stubDef, inst, ctx)).toEqual({});
  });
});

describe("runBlock", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns ok and captures outputs on 2xx", async () => {
    (global.fetch as any).mockResolvedValue(
      new Response(JSON.stringify({ out: "captured" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    const ctx: RuntimeContext = { socketSessionUuid: "u", ctxA: "from-ctx" };
    const inst: BlockInstance = { id: "1", kind: "stub", overrides: {} };
    const result = await runBlock(stubDef, inst, ctx);
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.captured).toEqual({ outKey: "captured" });
      expect(result.httpStatus).toBe(200);
    }
  });

  it("returns err on non-2xx", async () => {
    (global.fetch as any).mockResolvedValue(
      new Response(JSON.stringify({ error: "boom" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      })
    );
    const ctx: RuntimeContext = { socketSessionUuid: "u", ctxA: "x" };
    const inst: BlockInstance = { id: "1", kind: "stub", overrides: {} };
    const result = await runBlock(stubDef, inst, ctx);
    expect(result.status).toBe("err");
    if (result.status === "err") {
      expect(result.httpStatus).toBe(400);
    }
  });

  it("returns err on network throw", async () => {
    (global.fetch as any).mockRejectedValue(new Error("network down"));
    const ctx: RuntimeContext = { socketSessionUuid: "u", ctxA: "x" };
    const inst: BlockInstance = { id: "1", kind: "stub", overrides: {} };
    const result = await runBlock(stubDef, inst, ctx);
    expect(result.status).toBe("err");
    if (result.status === "err") {
      expect(result.error).toMatch(/network down/);
    }
  });
});

import { runScenarioFrom } from "../../src/execution/runScenario";
import { BLOCK_REGISTRY } from "../../src/blocks";

describe("runScenarioFrom", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("stops on first error and reports index", async () => {
    (global.fetch as any)
      .mockResolvedValueOnce(new Response(JSON.stringify({ jwt: "j", _id: "u" }), { status: 200, headers: { "content-type": "application/json" } }))
      .mockResolvedValueOnce(new Response("{}", { status: 500, headers: { "content-type": "application/json" } }));

    const blocks = [
      { id: "1", kind: "signin", overrides: { email: "a@b.com", password: "pw" } },
      { id: "2", kind: "profile", overrides: {} },
    ];
    let ctx = { socketSessionUuid: "u" } as any;
    const results: any[] = [];
    await runScenarioFrom(blocks, 0, ctx, (newCtx, idx, result) => {
      ctx = newCtx;
      results.push({ idx, status: result.status });
    });
    expect(results).toEqual([
      { idx: 0, status: "ok" },
      { idx: 1, status: "err" },
    ]);
    expect((global.fetch as any).mock.calls).toHaveLength(2);
  });
});

// ─── runBlock with env ────────────────────────────────────────────────────────
describe("runBlock – env propagation", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("passes envAuth bearer header to the fetch call when auth !== none", async () => {
    (global.fetch as any).mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200, headers: { "content-type": "application/json" } })
    );
    const def: BlockDef = {
      kind: "stub-jwt",
      label: "stub-jwt",
      auth: "jwt",
      inputs: [],
      outputs: [],
      build: () => ({ method: "GET", url: "https://api.example/protected", headers: {} }),
    };
    const inst: BlockInstance = { id: "99", kind: "stub-jwt", overrides: {} };
    const ctx: RuntimeContext = { socketSessionUuid: "u" };
    const env = {
      id: "e1",
      name: "Test",
      baseUrl: "https://api.example",
      auth: { kind: "bearer" as const, token: "env-bearer-tok" },
      headers: { "X-Tenant": "t1" },
      createdAt: "2026-05-12T00:00:00Z",
    };

    const result = await runBlock(def, inst, ctx, env);
    expect(result.status).toBe("ok");

    const [, init] = (global.fetch as any).mock.calls[0];
    expect(init.headers["Authorization"]).toBe("Bearer env-bearer-tok");
    expect(init.headers["X-Tenant"]).toBe("t1");
  });
});
