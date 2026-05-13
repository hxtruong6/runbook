// tests/projects/storage.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import {
  loadState,
  saveState,
  upsertBundle,
  deleteBundle,
  setActiveProject,
  setActiveVersion,
  getActiveProject,
  getActiveVersion,
  findVersion,
} from "../../src/projects/storage";
import type { ProjectBundle, ProjectVersion, ProjectsState } from "../../src/projects/types";

const STORAGE_KEY = "chairside-runner:projects";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeVersion = (version: string, overrides: Partial<ProjectVersion> = {}): ProjectVersion => ({
  version,
  releasedAt: "2026-01-01T00:00:00Z",
  releaseNotes: "Release notes",
  changes: [],
  blocks: [],
  scenarios: [],
  environments: [],
  docs: {},
  ...overrides,
});

const makeBundle = (id: string, overrides: Partial<ProjectBundle> = {}): ProjectBundle => ({
  id,
  name: `Project ${id}`,
  createdAt: "2026-01-01T00:00:00Z",
  versions: [makeVersion("1.0.0")],
  ...overrides,
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("projects/storage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // --- default state ---

  it("returns empty default state when nothing is stored", () => {
    expect(loadState()).toEqual({
      bundles: [],
      activeProjectId: null,
      activeVersionByProject: {},
    });
  });

  // --- saveState / loadState ---

  it("saveState + loadState round-trips correctly", () => {
    const bundle = makeBundle("proj-1");
    const state: ProjectsState = {
      bundles: [bundle],
      activeProjectId: "proj-1",
      activeVersionByProject: { "proj-1": "1.0.0" },
    };
    saveState(state);
    expect(loadState()).toEqual(state);
  });

  // --- upsertBundle ---

  it("upsertBundle adds a new bundle", () => {
    upsertBundle(makeBundle("proj-1"));
    expect(loadState().bundles).toHaveLength(1);
  });

  it("upsertBundle replaces a bundle with the same id", () => {
    upsertBundle(makeBundle("proj-1", { name: "Original" }));
    upsertBundle(makeBundle("proj-1", { name: "Updated" }));
    const state = loadState();
    expect(state.bundles).toHaveLength(1);
    expect(state.bundles[0].name).toBe("Updated");
  });

  it("upsertBundle adds a second distinct bundle", () => {
    upsertBundle(makeBundle("proj-1"));
    upsertBundle(makeBundle("proj-2"));
    expect(loadState().bundles).toHaveLength(2);
  });

  // --- deleteBundle ---

  it("deleteBundle removes the bundle by id", () => {
    upsertBundle(makeBundle("proj-1"));
    upsertBundle(makeBundle("proj-2"));
    deleteBundle("proj-1");
    const state = loadState();
    expect(state.bundles).toHaveLength(1);
    expect(state.bundles[0].id).toBe("proj-2");
  });

  it("deleteBundle clears activeProjectId when it matches the deleted id", () => {
    upsertBundle(makeBundle("proj-1"));
    setActiveProject("proj-1");
    deleteBundle("proj-1");
    expect(loadState().activeProjectId).toBeNull();
  });

  it("deleteBundle does NOT clear activeProjectId when deleting a different project", () => {
    upsertBundle(makeBundle("proj-1"));
    upsertBundle(makeBundle("proj-2"));
    setActiveProject("proj-2");
    deleteBundle("proj-1");
    expect(loadState().activeProjectId).toBe("proj-2");
  });

  it("deleteBundle removes the activeVersionByProject entry for the deleted id", () => {
    upsertBundle(makeBundle("proj-1"));
    setActiveVersion("proj-1", "1.0.0");
    deleteBundle("proj-1");
    const state = loadState();
    expect(state.activeVersionByProject["proj-1"]).toBeUndefined();
  });

  // --- setActiveProject ---

  it("setActiveProject persists the active project id", () => {
    setActiveProject("proj-1");
    expect(loadState().activeProjectId).toBe("proj-1");
  });

  it("setActiveProject accepts null to clear the active project", () => {
    setActiveProject("proj-1");
    setActiveProject(null);
    expect(loadState().activeProjectId).toBeNull();
  });

  // --- setActiveVersion ---

  it("setActiveVersion persists the version for a project", () => {
    setActiveVersion("proj-1", "2.0.0");
    expect(loadState().activeVersionByProject["proj-1"]).toBe("2.0.0");
  });

  it("setActiveVersion round-trips through loadState", () => {
    setActiveVersion("proj-1", "1.5.0");
    setActiveVersion("proj-2", "3.0.0");
    const state = loadState();
    expect(state.activeVersionByProject["proj-1"]).toBe("1.5.0");
    expect(state.activeVersionByProject["proj-2"]).toBe("3.0.0");
  });

  // --- getActiveProject ---

  it("getActiveProject returns null when no active project is set", () => {
    upsertBundle(makeBundle("proj-1"));
    expect(getActiveProject()).toBeNull();
  });

  it("getActiveProject returns the matching bundle when set", () => {
    const bundle = makeBundle("proj-1");
    upsertBundle(bundle);
    setActiveProject("proj-1");
    expect(getActiveProject()).toEqual(bundle);
  });

  it("getActiveProject returns null when activeProjectId has no matching bundle", () => {
    upsertBundle(makeBundle("proj-1"));
    setActiveProject("proj-999");
    expect(getActiveProject()).toBeNull();
  });

  // --- getActiveVersion ---

  it("getActiveVersion returns null when no project is active", () => {
    upsertBundle(makeBundle("proj-1"));
    expect(getActiveVersion()).toBeNull();
  });

  it("getActiveVersion returns versions[0] (newest) when project active but no explicit version set", () => {
    const bundle = makeBundle("proj-1", {
      versions: [makeVersion("2.0.0"), makeVersion("1.0.0")],
    });
    upsertBundle(bundle);
    setActiveProject("proj-1");
    const v = getActiveVersion();
    expect(v?.version).toBe("2.0.0");
  });

  it("getActiveVersion returns the explicitly chosen version", () => {
    const bundle = makeBundle("proj-1", {
      versions: [makeVersion("2.0.0"), makeVersion("1.0.0")],
    });
    upsertBundle(bundle);
    setActiveProject("proj-1");
    setActiveVersion("proj-1", "1.0.0");
    expect(getActiveVersion()?.version).toBe("1.0.0");
  });

  it("getActiveVersion falls back to versions[0] when chosen version no longer exists in bundle", () => {
    upsertBundle(makeBundle("proj-1", { versions: [makeVersion("2.0.0"), makeVersion("1.0.0")] }));
    setActiveProject("proj-1");
    setActiveVersion("proj-1", "1.0.0");
    // Replace bundle without the chosen version
    upsertBundle(makeBundle("proj-1", { versions: [makeVersion("3.0.0"), makeVersion("2.0.0")] }));
    // Chosen "1.0.0" is gone; should fall back to versions[0] = "3.0.0"
    expect(getActiveVersion()?.version).toBe("3.0.0");
  });

  // --- findVersion ---

  it("findVersion returns matching version by string", () => {
    const bundle = makeBundle("proj-1", {
      versions: [makeVersion("2.0.0"), makeVersion("1.0.0")],
    });
    const v = findVersion(bundle, "1.0.0");
    expect(v?.version).toBe("1.0.0");
  });

  it("findVersion returns null for unknown version", () => {
    const bundle = makeBundle("proj-1");
    expect(findVersion(bundle, "99.0.0")).toBeNull();
  });

  // --- malformed stored JSON ---

  it("loadState returns default when stored JSON is malformed", () => {
    localStorage.setItem(STORAGE_KEY, "not valid json {{{");
    expect(loadState()).toEqual({ bundles: [], activeProjectId: null, activeVersionByProject: {} });
  });

  it("loadState returns default when stored shape is wrong", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ bogus: true }));
    expect(loadState()).toEqual({ bundles: [], activeProjectId: null, activeVersionByProject: {} });
  });
});
