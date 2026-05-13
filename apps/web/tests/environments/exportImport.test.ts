// tests/environments/exportImport.test.ts
import { describe, it, expect } from "vitest";
import { environmentToJson, environmentFromJson } from "../../src/environments/exportImport";
import type { Environment } from "../../src/environments/types";

const sampleEnv: Environment = {
  id: "env-1",
  name: "Production",
  baseUrl: "https://api.example.com",
  auth: { kind: "bearer", token: "secret-token" },
  headers: { "X-Tenant": "acme" },
  createdAt: "2026-05-12T00:00:00Z",
};

describe("environments/exportImport", () => {
  it("round-trips through JSON", () => {
    const json = environmentToJson(sampleEnv);
    const parsed = environmentFromJson(json);
    expect(parsed).toEqual(sampleEnv);
  });

  it("throws on malformed JSON", () => {
    expect(() => environmentFromJson("not json {{{")).toThrow();
  });

  it("throws on valid JSON with wrong shape (missing baseUrl)", () => {
    const { baseUrl: _b, ...withoutBaseUrl } = sampleEnv;
    expect(() => environmentFromJson(JSON.stringify(withoutBaseUrl))).toThrow();
  });

  it("throws on valid JSON with invalid auth kind", () => {
    const bad = { ...sampleEnv, auth: { kind: "oauth2" } };
    expect(() => environmentFromJson(JSON.stringify(bad))).toThrow();
  });

  it("throws on valid JSON with non-URL baseUrl", () => {
    const bad = { ...sampleEnv, baseUrl: "not-a-url" };
    expect(() => environmentFromJson(JSON.stringify(bad))).toThrow();
  });
});
