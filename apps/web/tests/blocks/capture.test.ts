// tests/blocks/capture.test.ts
import { describe, it, expect } from "vitest";
import { captureOutputs } from "../../src/blocks/capture";

describe("captureOutputs", () => {
  it("extracts a single dot path", () => {
    const out = captureOutputs({ data: { syncToken: "tok" } }, [
      { jsonPath: "data.syncToken", contextKey: "syncToken" },
    ]);
    expect(out).toEqual({ syncToken: "tok" });
  });

  it("extracts nested paths with arrays via [n]", () => {
    const out = captureOutputs(
      { practices: [{ id: "p1" }, { id: "p2" }] },
      [{ jsonPath: "practices[0].id", contextKey: "practiceId" }]
    );
    expect(out).toEqual({ practiceId: "p1" });
  });

  it("captures the whole response when jsonPath is '$'", () => {
    const out = captureOutputs({ a: 1 }, [{ jsonPath: "$", contextKey: "full" }]);
    expect(out).toEqual({ full: { a: 1 } });
  });

  it("skips outputs whose path is missing", () => {
    const out = captureOutputs({}, [{ jsonPath: "missing.key", contextKey: "x" }]);
    expect(out).toEqual({});
  });
});
