// tests/projects/types.test.ts
import { describe, it, expect } from "vitest";
import {
  ChangeEntrySchema,
  VersionSchema,
  ProjectBundleSchema,
  ProjectsStateSchema,
} from "../../src/projects/types";

// ---------------------------------------------------------------------------
// Minimal fixtures
// ---------------------------------------------------------------------------

const minimalBlock = {
  kind: "signin",
  label: "Sign In",
  auth: "none",
  inputs: [],
  outputs: [],
  request: { method: "POST", urlTemplate: "/auth/login" },
};

const minimalEnv = {
  id: "env-1",
  name: "Dev",
  baseUrl: "https://api.example.com",
  auth: { kind: "none" },
  headers: {},
  createdAt: "2026-01-01T00:00:00Z",
};

const minimalVersion = {
  version: "1.0.0",
  releasedAt: "2026-01-01T00:00:00Z",
  releaseNotes: "Initial release",
  changes: [],
  blocks: [],
  scenarios: [],
  environments: [],
  docs: {},
};

const minimalBundle = {
  id: "test-project",
  name: "Test Project",
  createdAt: "2026-01-01T00:00:00Z",
  versions: [minimalVersion],
};

// ---------------------------------------------------------------------------
// ChangeEntrySchema
// ---------------------------------------------------------------------------

describe("ChangeEntrySchema", () => {
  it.each(["added", "modified", "deprecated", "removed", "fixed", "note"] as const)(
    "accepts type '%s'",
    (type) => {
      const result = ChangeEntrySchema.safeParse({ type, summary: "Some change" });
      expect(result.success).toBe(true);
    }
  );

  it("rejects unknown type", () => {
    const result = ChangeEntrySchema.safeParse({ type: "unknown", summary: "bad" });
    expect(result.success).toBe(false);
  });

  it("accepts optional target field", () => {
    const result = ChangeEntrySchema.safeParse({
      type: "added",
      summary: "added block",
      target: "signin",
    });
    expect(result.success).toBe(true);
  });

  it("accepts optional breaking flag", () => {
    const result = ChangeEntrySchema.safeParse({
      type: "removed",
      summary: "removed old block",
      breaking: true,
    });
    expect(result.success).toBe(true);
  });

  it("accepts optional removeBy field", () => {
    const result = ChangeEntrySchema.safeParse({
      type: "deprecated",
      summary: "deprecated field",
      removeBy: "2.0.0",
    });
    expect(result.success).toBe(true);
  });

  it("rejects entry without summary", () => {
    const result = ChangeEntrySchema.safeParse({ type: "fixed" });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// VersionSchema
// ---------------------------------------------------------------------------

describe("VersionSchema", () => {
  it("accepts a minimal valid version", () => {
    const result = VersionSchema.safeParse(minimalVersion);
    expect(result.success).toBe(true);
  });

  it("accepts a version with optional docs map", () => {
    const result = VersionSchema.safeParse({
      ...minimalVersion,
      docs: { signin: "## Sign In\nSome docs" },
    });
    expect(result.success).toBe(true);
  });

  it("accepts a version with blocks, scenarios, and environments", () => {
    const result = VersionSchema.safeParse({
      ...minimalVersion,
      blocks: [minimalBlock],
      environments: [minimalEnv],
      scenarios: [
        {
          id: "sc-1",
          name: "Login flow",
          createdAt: "2026-01-01T00:00:00Z",
          blocks: [],
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects a version with an invalid block (missing auth field)", () => {
    const badBlock = { kind: "signin", label: "Sign In", inputs: [], outputs: [], request: { method: "POST", urlTemplate: "/auth" } };
    const result = VersionSchema.safeParse({ ...minimalVersion, blocks: [badBlock] });
    expect(result.success).toBe(false);
  });

  it("rejects a version without required fields", () => {
    const result = VersionSchema.safeParse({ version: "1.0.0" });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// ProjectBundleSchema
// ---------------------------------------------------------------------------

describe("ProjectBundleSchema", () => {
  it("accepts a minimal valid bundle with one version", () => {
    const result = ProjectBundleSchema.safeParse(minimalBundle);
    expect(result.success).toBe(true);
  });

  it("accepts a bundle with optional description", () => {
    const result = ProjectBundleSchema.safeParse({
      ...minimalBundle,
      description: "A test project",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a bundle without versions array", () => {
    const { versions: _v, ...noVersions } = minimalBundle;
    const result = ProjectBundleSchema.safeParse(noVersions);
    expect(result.success).toBe(false);
  });

  it("rejects a bundle without id", () => {
    const { id: _id, ...noId } = minimalBundle;
    const result = ProjectBundleSchema.safeParse(noId);
    expect(result.success).toBe(false);
  });

  it("rejects a bundle where a version's blocks contain an invalid BlockDefData", () => {
    const badVersion = {
      ...minimalVersion,
      blocks: [{ kind: "x", label: "X" /* missing auth, inputs, outputs, request */ }],
    };
    const result = ProjectBundleSchema.safeParse({ ...minimalBundle, versions: [badVersion] });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// ProjectsStateSchema
// ---------------------------------------------------------------------------

describe("ProjectsStateSchema", () => {
  it("accepts empty state", () => {
    const result = ProjectsStateSchema.safeParse({
      bundles: [],
      activeProjectId: null,
      activeVersionByProject: {},
    });
    expect(result.success).toBe(true);
  });

  it("accepts populated state", () => {
    const result = ProjectsStateSchema.safeParse({
      bundles: [minimalBundle],
      activeProjectId: "test-project",
      activeVersionByProject: { "test-project": "1.0.0" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects state missing activeProjectId", () => {
    const result = ProjectsStateSchema.safeParse({
      bundles: [],
      activeVersionByProject: {},
    });
    expect(result.success).toBe(false);
  });
});
