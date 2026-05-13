// tests/projects/exportImport.test.ts
import { describe, it, expect } from "vitest";
import { bundleToJson, bundleFromJson } from "../../src/projects/exportImport";
import type { ProjectBundle } from "../../src/projects/types";

const sampleBundle: ProjectBundle = {
  id: "test-project",
  name: "Test Project",
  description: "A project for testing",
  createdAt: "2026-01-01T00:00:00Z",
  versions: [
    {
      version: "1.0.0",
      releasedAt: "2026-01-01T00:00:00Z",
      releaseNotes: "## Initial release\n\nFirst version.",
      changes: [
        { type: "added", summary: "Initial blocks", target: "signin" },
      ],
      blocks: [
        {
          kind: "signin",
          label: "Sign In",
          auth: "none",
          inputs: [],
          outputs: [],
          request: { method: "POST", urlTemplate: "/auth/login" },
        },
      ],
      scenarios: [],
      environments: [],
      docs: { signin: "## Sign In\nDocs here." },
    },
  ],
};

describe("projects/exportImport", () => {
  it("round-trips a bundle through JSON", () => {
    const json = bundleToJson(sampleBundle);
    const parsed = bundleFromJson(json);
    expect(parsed).toEqual(sampleBundle);
  });

  it("bundleToJson produces pretty-printed JSON", () => {
    const json = bundleToJson(sampleBundle);
    // Pretty-printed JSON has newlines and indentation
    expect(json).toContain("\n");
    expect(json).toContain("  ");
  });

  it("throws on malformed JSON", () => {
    expect(() => bundleFromJson("not json {{{")).toThrow();
  });

  it("throws on valid JSON with missing versions array", () => {
    const { versions: _v, ...noVersions } = sampleBundle;
    expect(() => bundleFromJson(JSON.stringify(noVersions))).toThrow();
  });

  it("throws on valid JSON with missing id", () => {
    const { id: _id, ...noId } = sampleBundle;
    expect(() => bundleFromJson(JSON.stringify(noId))).toThrow();
  });
});
