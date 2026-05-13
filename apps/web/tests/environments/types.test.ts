// tests/environments/types.test.ts
import { describe, it, expect } from "vitest";
import { AuthConfigSchema, EnvironmentSchema, EnvironmentsStateSchema } from "../../src/environments/types";

describe("AuthConfigSchema", () => {
  it("validates bearer auth with token", () => {
    const result = AuthConfigSchema.safeParse({ kind: "bearer", token: "abc123" });
    expect(result.success).toBe(true);
  });

  it("validates cookie auth without token", () => {
    const result = AuthConfigSchema.safeParse({ kind: "cookie" });
    expect(result.success).toBe(true);
  });

  it("validates cookie auth with optional token", () => {
    const result = AuthConfigSchema.safeParse({ kind: "cookie", token: "tkn" });
    expect(result.success).toBe(true);
  });

  it("validates apiKey auth with header placement", () => {
    const result = AuthConfigSchema.safeParse({ kind: "apiKey", in: "header", name: "X-Api-Key", value: "secret" });
    expect(result.success).toBe(true);
  });

  it("validates apiKey auth with query placement", () => {
    const result = AuthConfigSchema.safeParse({ kind: "apiKey", in: "query", name: "api_key", value: "secret" });
    expect(result.success).toBe(true);
  });

  it("validates basic auth with username and password", () => {
    const result = AuthConfigSchema.safeParse({ kind: "basic", username: "user", password: "pass" });
    expect(result.success).toBe(true);
  });

  it("validates none auth", () => {
    const result = AuthConfigSchema.safeParse({ kind: "none" });
    expect(result.success).toBe(true);
  });

  it("rejects bearer auth without token", () => {
    const result = AuthConfigSchema.safeParse({ kind: "bearer" });
    expect(result.success).toBe(false);
  });

  it("rejects apiKey auth without name", () => {
    const result = AuthConfigSchema.safeParse({ kind: "apiKey", in: "header", value: "secret" });
    expect(result.success).toBe(false);
  });

  it("rejects basic auth without password", () => {
    const result = AuthConfigSchema.safeParse({ kind: "basic", username: "user" });
    expect(result.success).toBe(false);
  });

  it("rejects unknown kind", () => {
    const result = AuthConfigSchema.safeParse({ kind: "oauth" });
    expect(result.success).toBe(false);
  });
});

describe("EnvironmentSchema", () => {
  const validEnv = {
    id: "env-1",
    name: "Test Env",
    baseUrl: "https://api.example.com",
    auth: { kind: "none" },
    headers: {},
    createdAt: "2026-05-12T00:00:00Z",
  };

  it("validates a well-formed environment", () => {
    const result = EnvironmentSchema.safeParse(validEnv);
    expect(result.success).toBe(true);
  });

  it("rejects non-URL baseUrl", () => {
    const result = EnvironmentSchema.safeParse({ ...validEnv, baseUrl: "not-a-url" });
    expect(result.success).toBe(false);
  });

  it("defaults headers to {} when omitted", () => {
    const { headers: _h, ...withoutHeaders } = validEnv;
    const result = EnvironmentSchema.safeParse(withoutHeaders);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.headers).toEqual({});
    }
  });

  it("accepts custom headers", () => {
    const result = EnvironmentSchema.safeParse({ ...validEnv, headers: { "X-Tenant": "acme" } });
    expect(result.success).toBe(true);
  });
});

describe("EnvironmentsStateSchema", () => {
  it("validates state with environments and null activeId", () => {
    const result = EnvironmentsStateSchema.safeParse({ environments: [], activeId: null });
    expect(result.success).toBe(true);
  });

  it("validates state with a string activeId", () => {
    const result = EnvironmentsStateSchema.safeParse({
      environments: [],
      activeId: "env-1",
    });
    expect(result.success).toBe(true);
  });
});
