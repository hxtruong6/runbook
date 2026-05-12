import { describe, it, expect } from "vitest";
import { signinDef } from "../../src/blocks/signin";
import { captureOutputs } from "../../src/blocks/capture";

describe("signinDef", () => {
  it("builds a POST to /v1/user/auth/signin with email+password body", () => {
    const req = signinDef.build({ email: "a@b.com", password: "pw" });
    expect(req.method).toBe("POST");
    expect(req.url).toMatch(/\/v1\/user\/auth\/signin$/);
    expect(req.body).toEqual({ email: "a@b.com", password: "pw" });
    expect(req.headers["x-client-version"]).toBe("0.4.0");
  });

  it("captures jwt and userId from response", () => {
    const captured = captureOutputs(
      { jwt: "eyJ", _id: "u1", role: "DENTIST" },
      signinDef.outputs
    );
    expect(captured.jwt).toBe("eyJ");
    expect(captured.userId).toBe("u1");
  });

  it("has auth: none", () => {
    expect(signinDef.auth).toBe("none");
  });
});
