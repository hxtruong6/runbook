// tests/blocks/buildRegistry.test.ts
import { describe, it, expect } from "vitest";
import { buildRegistry, COMPILED_BLOCKS } from "../../src/blocks/index";
import type { BlockDefData } from "../../src/blocks/dataBlock";

const EXPECTED_COMPILED_KINDS = [
  "signin",
  "profile",
  "featureHighlightsGet",
  "featureHighlightsDismiss",
  "verifyDeviceToken",
  "startChairside",
  "uploadPhoto",
  "getOrthoReview",
  "updateChairsideStatus",
  "socketConnect",
];

const BASE_URL = "https://test.example.com";
const resolveBaseUrl = () => BASE_URL;

function makeDataDef(kind: string, urlTemplate: string): BlockDefData {
  return {
    kind,
    label: `Data block ${kind}`,
    auth: "none",
    inputs: [
      { name: "email", label: "Email", type: "string" },
      { name: "password", label: "Password", type: "password" },
    ],
    outputs: [],
    request: {
      method: "POST",
      urlTemplate,
      bodyTemplate: { email: "{{email}}", password: "{{password}}" },
    },
  };
}

describe("buildRegistry", () => {
  it("with empty data defs returns all 10 compiled kinds", () => {
    const registry = buildRegistry([], resolveBaseUrl);
    for (const kind of EXPECTED_COMPILED_KINDS) {
      expect(registry).toHaveProperty(kind);
    }
    expect(Object.keys(registry)).toHaveLength(EXPECTED_COMPILED_KINDS.length);
  });

  it("with empty data defs result is identical to COMPILED_BLOCKS", () => {
    const registry = buildRegistry([], resolveBaseUrl);
    for (const kind of EXPECTED_COMPILED_KINDS) {
      expect(registry[kind]).toBe(COMPILED_BLOCKS[kind]);
    }
  });

  it("a data def with a NEW kind appends to registry", () => {
    const newDef = makeDataDef("myNewBlock", "/api/new-endpoint");
    const registry = buildRegistry([newDef], resolveBaseUrl);
    expect(registry).toHaveProperty("myNewBlock");
    expect(Object.keys(registry)).toHaveLength(EXPECTED_COMPILED_KINDS.length + 1);
  });

  it("new kind def has correct label", () => {
    const newDef = makeDataDef("myNewBlock", "/api/new-endpoint");
    const registry = buildRegistry([newDef], resolveBaseUrl);
    expect(registry["myNewBlock"].label).toBe("Data block myNewBlock");
  });

  it("a data def with kind 'signin' OVERRIDES compiled signin", () => {
    const overrideDef = makeDataDef("signin", "/v2/custom/auth");
    const registry = buildRegistry([overrideDef], resolveBaseUrl);
    // Should still have signin
    expect(registry).toHaveProperty("signin");
    // The override should win — build URL should use data def's urlTemplate
    const req = registry["signin"].build({ email: "a", password: "b" });
    expect(req.url).toContain("/v2/custom/auth");
    // Must NOT be the compiled path
    expect(req.url).not.toContain("/v1/user/auth/signin");
  });

  it("override signin uses resolveBaseUrl for URL prefix", () => {
    const overrideDef = makeDataDef("signin", "/v2/custom/auth");
    const registry = buildRegistry([overrideDef], resolveBaseUrl);
    const req = registry["signin"].build({ email: "a", password: "b" });
    expect(req.url).toBe(`${BASE_URL}/v2/custom/auth`);
  });

  it("override does not affect total kind count", () => {
    const overrideDef = makeDataDef("signin", "/v2/custom/auth");
    const registry = buildRegistry([overrideDef], resolveBaseUrl);
    expect(Object.keys(registry)).toHaveLength(EXPECTED_COMPILED_KINDS.length);
  });

  it("compiled blocks are NOT mutated by buildRegistry", () => {
    const overrideDef = makeDataDef("signin", "/v2/custom/auth");
    buildRegistry([overrideDef], resolveBaseUrl);
    // COMPILED_BLOCKS.signin should still be the original
    const req = COMPILED_BLOCKS["signin"].build({ email: "a", password: "b" });
    expect(req.url).toContain("/v1/user/auth/signin");
  });

  it("multiple data defs with same kind — last one wins", () => {
    const first = makeDataDef("newKind", "/first");
    const second = makeDataDef("newKind", "/second");
    const registry = buildRegistry([first, second], resolveBaseUrl);
    const req = registry["newKind"].build({});
    expect(req.url).toContain("/second");
  });
});
