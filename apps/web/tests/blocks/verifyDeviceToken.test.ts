// tests/blocks/verifyDeviceToken.test.ts
import { describe, it, expect } from "vitest";
import { verifyDeviceTokenDef } from "../../src/blocks/verifyDeviceToken";
import { captureOutputs } from "../../src/blocks/capture";

describe("verifyDeviceTokenDef", () => {
  it("POSTs token in body to /chairside/device-token", () => {
    const req = verifyDeviceTokenDef.build({ orthoReviewChairsideToken: "tok" });
    expect(req.method).toBe("POST");
    expect(req.url).toMatch(/\/chairside\/device-token$/);
    expect(req.body).toEqual({ token: "tok" });
  });

  it("captures practices[0].id as practiceId", () => {
    const captured = captureOutputs(
      { user: { id: "u1" }, practices: [{ id: "p1" }, { id: "p2" }], corporate: { id: "c1" } },
      verifyDeviceTokenDef.outputs
    );
    expect(captured.practiceId).toBe("p1");
    expect(captured.userId).toBe("u1");
  });
});
