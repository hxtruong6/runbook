// tests/projects/sampleBundle.test.ts
import { describe, it, expect } from "vitest";
import sample from "../../samples/32co-chairside.bundle.json";
import { ProjectBundleSchema } from "../../src/projects/types";
import { BlockDefDataSchema } from "../../src/blocks/dataBlock";

describe("32CO chairside sample bundle", () => {
  it("parses via ProjectBundleSchema", () => {
    const result = ProjectBundleSchema.safeParse(sample);
    expect(result.success).toBe(true);
  });

  it("has 9 blocks in v1.0.0", () => {
    expect(sample.versions[0].blocks.length).toBe(9);
  });

  it("has 3 scenarios in v1.0.0", () => {
    expect(sample.versions[0].scenarios.length).toBe(3);
  });

  it("every block parses via BlockDefDataSchema", () => {
    for (const block of sample.versions[0].blocks) {
      const result = BlockDefDataSchema.safeParse(block);
      expect(result.success, `Block ${block.kind} failed: ${JSON.stringify((result as { error?: unknown }).error)}`).toBe(true);
    }
  });
});
