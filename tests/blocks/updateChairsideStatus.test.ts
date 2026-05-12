import { describe, it, expect } from "vitest";
import { updateChairsideStatusDef } from "../../src/blocks/updateChairsideStatus";

describe("updateChairsideStatusDef", () => {
  it("PUTs to /chairside/:id with syncToken and chairsideStatus", () => {
    const req = updateChairsideStatusDef.build({
      orthoReviewId: "or1",
      syncToken: "stk",
      chairsideStatus: "COMPLETED",
    });
    expect(req.method).toBe("PUT");
    expect(req.url).toMatch(/\/chairside\/or1$/);
    expect(req.body).toEqual({ syncToken: "stk", chairsideStatus: "COMPLETED" });
  });

  it("declares chairsideStatus as enum of IN_PROGRESS/COMPLETED/ARCHIVED", () => {
    const field = updateChairsideStatusDef.inputs.find((i) => i.name === "chairsideStatus")!;
    expect(field.enumValues).toEqual(["IN_PROGRESS", "COMPLETED", "ARCHIVED"]);
  });
});
