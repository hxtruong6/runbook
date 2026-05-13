// tests/scenarios/types.test.ts
import { describe, it, expect } from "vitest";
import { ScenarioSchema } from "../../src/scenarios/types";

const baseScenario = {
  id: "s1",
  name: "My Scenario",
  createdAt: "2026-05-12T00:00:00Z",
  blocks: [],
};

describe("ScenarioSchema reusable field", () => {
  it("parses scenario without reusable field — defaults to false", () => {
    const result = ScenarioSchema.parse(baseScenario);
    expect(result.reusable).toBe(false);
  });

  it("parses scenario with reusable: true — preserves value", () => {
    const result = ScenarioSchema.parse({ ...baseScenario, reusable: true });
    expect(result.reusable).toBe(true);
  });

  it("parses scenario with reusable: false explicitly", () => {
    const result = ScenarioSchema.parse({ ...baseScenario, reusable: false });
    expect(result.reusable).toBe(false);
  });
});
