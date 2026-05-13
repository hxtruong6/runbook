// tests/projects/sampleBundle.functional.test.ts
import { describe, it, expect } from "vitest";
import sample from "../../samples/32co-chairside.bundle.json";
import { buildRegistry } from "../../src/blocks/index";
import type { BlockDefData } from "../../src/blocks/dataBlock";

const BASE = "https://api.example";
const registry = buildRegistry(
  sample.versions[0].blocks as BlockDefData[],
  () => BASE
);

describe("sampleBundle functional — buildRegistry", () => {
  const EXPECTED_KINDS = [
    "signin",
    "profile",
    "featureHighlightsGet",
    "featureHighlightsDismiss",
    "verifyDeviceToken",
    "startChairside",
    "uploadPhoto",
    "getOrthoReview",
    "updateChairsideStatus",
  ];

  it("registry contains all 9 block kinds", () => {
    for (const kind of EXPECTED_KINDS) {
      expect(registry[kind], `missing kind: ${kind}`).toBeDefined();
    }
  });

  it("signin — correct method and URL and body", () => {
    const req = registry.signin.build({ email: "a@b.com", password: "pw" });
    expect(req.method).toBe("POST");
    expect(req.url).toMatch(/\/v1\/user\/auth\/signin$/);
    expect(req.body).toMatchObject({ email: "a@b.com", password: "pw" });
  });

  it("uploadPhoto with socketSessionUuid — URL contains query param", () => {
    const req = registry.uploadPhoto.build({
      orthoReviewId: "or1",
      syncToken: "stk",
      slot: "chairside-full-face",
      url: "https://x",
      socketSessionUuid: "uuid-1",
    });
    expect(req.url).toContain("/chairside/or1/photos?socketSessionUuid=uuid-1");
  });

  it("uploadPhoto WITHOUT socketSessionUuid — no query string", () => {
    const req = registry.uploadPhoto.build({
      orthoReviewId: "or1",
      syncToken: "stk",
      slot: "chairside-full-face",
      url: "https://x",
    });
    expect(req.url).toMatch(/\/chairside\/or1\/photos$/);
    expect(req.url).not.toContain("?");
  });
});
