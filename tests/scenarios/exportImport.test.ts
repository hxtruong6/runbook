import { describe, it, expect } from "vitest";
import { scenarioToJson, scenarioFromJson } from "../../src/scenarios/exportImport";
import type { Scenario } from "../../src/scenarios/types";

describe("scenario export/import", () => {
  const s: Scenario = {
    id: "x",
    name: "Test",
    createdAt: "2026-05-12T00:00:00Z",
    blocks: [{ id: "b1", kind: "signin", overrides: { email: "a@b.com" } }],
  };

  it("round-trips through JSON", () => {
    const json = scenarioToJson(s);
    const parsed = scenarioFromJson(json);
    expect(parsed).toEqual(s);
  });

  it("rejects malformed JSON", () => {
    expect(() => scenarioFromJson("not json")).toThrow();
  });

  it("rejects valid JSON with wrong shape", () => {
    expect(() => scenarioFromJson(JSON.stringify({ bogus: true }))).toThrow();
  });
});
