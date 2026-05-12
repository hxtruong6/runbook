// tests/blocks/uploadPhoto.test.ts
import { describe, it, expect } from "vitest";
import { uploadPhotoDef } from "../../src/blocks/uploadPhoto";

describe("uploadPhotoDef", () => {
  it("POSTs to /chairside/:id/photos with socketSessionUuid in query", () => {
    const req = uploadPhotoDef.build({
      orthoReviewId: "or1",
      syncToken: "stk",
      slot: "chairside-full-face",
      url: "https://x/y.jpg",
      socketSessionUuid: "uuid-1",
    });
    expect(req.method).toBe("POST");
    expect(req.url).toMatch(/\/chairside\/or1\/photos\?socketSessionUuid=uuid-1$/);
    expect(req.body).toEqual({
      syncToken: "stk",
      slot: "chairside-full-face",
      url: "https://x/y.jpg",
    });
  });

  it("omits query when socketSessionUuid is absent", () => {
    const req = uploadPhotoDef.build({
      orthoReviewId: "or1",
      syncToken: "stk",
      slot: "chairside-close-up",
      url: "https://x/z.jpg",
    });
    expect(req.url).toMatch(/\/chairside\/or1\/photos$/);
  });

  it("declares slot as an enum of 4 values", () => {
    const slotField = uploadPhotoDef.inputs.find((i) => i.name === "slot")!;
    expect(slotField.type).toBe("enum");
    expect(slotField.enumValues).toEqual([
      "chairside-full-face",
      "chairside-close-up",
      "chairside-upper-arch",
      "chairside-lower-arch",
    ]);
  });
});
