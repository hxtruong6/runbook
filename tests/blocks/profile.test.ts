import { describe, it, expect } from "vitest";
import { profileDef } from "../../src/blocks/profile";
import { captureOutputs } from "../../src/blocks/capture";

describe("profileDef", () => {
  it("builds a GET to /v1/user/auth/profile", () => {
    const req = profileDef.build({});
    expect(req.method).toBe("GET");
    expect(req.url).toMatch(/\/v1\/user\/auth\/profile$/);
  });

  it("captures chairside fields", () => {
    const captured = captureOutputs(
      { orthoReviewChairsideToken: "tok", isChairsideEnabled: true },
      profileDef.outputs
    );
    expect(captured).toEqual({
      orthoReviewChairsideToken: "tok",
      isChairsideEnabled: true,
    });
  });

  it("has auth: cookie-or-jwt", () => {
    expect(profileDef.auth).toBe("cookie-or-jwt");
  });
});
