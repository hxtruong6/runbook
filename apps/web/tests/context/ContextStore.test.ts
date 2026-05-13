// tests/context/ContextStore.test.ts
import { describe, it, expect, vi } from "vitest";
import { contextReducer, makeInitialContext } from "../../src/context/ContextStore";

describe("contextReducer", () => {
  it("makeInitialContext generates a socketSessionUuid", () => {
    const ctx = makeInitialContext();
    expect(typeof ctx.socketSessionUuid).toBe("string");
    expect(ctx.socketSessionUuid.length).toBeGreaterThan(0);
  });

  it("MERGE merges new keys into context", () => {
    const ctx = makeInitialContext();
    const next = contextReducer(ctx, { type: "MERGE", values: { jwt: "abc" } });
    expect(next.jwt).toBe("abc");
    expect(next.socketSessionUuid).toBe(ctx.socketSessionUuid);
  });

  it("MERGE overwrites existing keys", () => {
    const ctx = { ...makeInitialContext(), jwt: "old" };
    const next = contextReducer(ctx, { type: "MERGE", values: { jwt: "new" } });
    expect(next.jwt).toBe("new");
  });

  it("SET_KEY sets a single key", () => {
    const ctx = makeInitialContext();
    const next = contextReducer(ctx, { type: "SET_KEY", key: "syncToken", value: "tok" });
    expect(next.syncToken).toBe("tok");
  });

  it("RESET clears all keys except a freshly generated socketSessionUuid", () => {
    const ctx = { ...makeInitialContext(), jwt: "x", syncToken: "y" };
    const next = contextReducer(ctx, { type: "RESET" });
    expect(next.jwt).toBeUndefined();
    expect(next.syncToken).toBeUndefined();
    expect(typeof next.socketSessionUuid).toBe("string");
    expect(next.socketSessionUuid).not.toBe(ctx.socketSessionUuid);
  });
});
