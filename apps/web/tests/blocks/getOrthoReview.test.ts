import { describe, it, expect } from "vitest";
import { getOrthoReviewDef } from "../../src/blocks/getOrthoReview";

describe("getOrthoReviewDef", () => {
  it("GETs /dentist/ortho-reviews/:id", () => {
    const req = getOrthoReviewDef.build({ orthoReviewId: "or1" });
    expect(req.method).toBe("GET");
    expect(req.url).toMatch(/\/aligner\/dentist\/ortho-reviews\/or1$/);
  });

  it("uses cookie-or-jwt auth", () => {
    expect(getOrthoReviewDef.auth).toBe("cookie-or-jwt");
  });
});
