// tests/blocks/scenarioRef.test.ts
import { describe, it, expect } from "vitest";
import {
  SCENARIO_REF_KIND,
  parseScenarioRefOverrides,
  isScenarioRefInstance,
} from "../../src/blocks/scenarioRef";

describe("scenarioRef", () => {
  describe("parseScenarioRefOverrides", () => {
    it("parses a valid minimal input with defaults applied", () => {
      const result = parseScenarioRefOverrides({ scenarioId: "abc" });
      expect(result.scenarioId).toBe("abc");
      expect(result.continueOnError).toBe(false);
      expect(result.contextOverrides).toBeUndefined();
    });

    it("parses with all fields set", () => {
      const result = parseScenarioRefOverrides({
        scenarioId: "xyz",
        continueOnError: true,
        contextOverrides: { key1: "value1", key2: 42 },
      });
      expect(result.scenarioId).toBe("xyz");
      expect(result.continueOnError).toBe(true);
      expect(result.contextOverrides).toEqual({ key1: "value1", key2: 42 });
    });

    it("rejects when scenarioId is empty string", () => {
      expect(() => parseScenarioRefOverrides({ scenarioId: "" })).toThrow();
    });

    it("rejects when scenarioId is missing", () => {
      expect(() => parseScenarioRefOverrides({})).toThrow();
    });
  });

  describe("isScenarioRefInstance", () => {
    it("returns true for kind scenario-ref", () => {
      expect(isScenarioRefInstance({ kind: SCENARIO_REF_KIND })).toBe(true);
    });

    it("returns false for other kinds", () => {
      expect(isScenarioRefInstance({ kind: "signin" })).toBe(false);
      expect(isScenarioRefInstance({ kind: "capture" })).toBe(false);
      expect(isScenarioRefInstance({ kind: "" })).toBe(false);
    });
  });
});
