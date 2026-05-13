// tests/blocks/startChairside.test.ts
import { describe, it, expect } from "vitest";
import { startChairsideDef } from "../../src/blocks/startChairside";
import { captureOutputs } from "../../src/blocks/capture";

describe("startChairsideDef", () => {
  it("POSTs to /chairside with body fields", () => {
    const req = startChairsideDef.build({
      firstName: "A",
      lastName: "B",
      practiceId: "p1",
      orthoReviewChairsideToken: "tok",
    });
    expect(req.method).toBe("POST");
    expect(req.url).toMatch(/\/aligner\/user\/ortho-reviews\/chairside$/);
    expect(req.body).toEqual({
      firstName: "A",
      lastName: "B",
      practiceId: "p1",
      orthoReviewChairsideToken: "tok",
    });
  });

  it("captures syncToken and orthoReviewId", () => {
    const captured = captureOutputs(
      { syncToken: "stk", orthoReview: { id: "or1" } },
      startChairsideDef.outputs
    );
    expect(captured).toEqual({ syncToken: "stk", orthoReviewId: "or1" });
  });
});
