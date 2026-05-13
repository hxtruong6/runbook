// tests/projects/ProjectsStore.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  projectsReducer,
  makeInitialProjectsState,
  type ProjectsAction,
} from "../../src/projects/ProjectsStore";
import type { ProjectBundle, ProjectVersion, ProjectsState } from "../../src/projects/types";

// ---------------------------------------------------------------------------
// Mock storage helpers to avoid localStorage side-effects in reducer tests
// ---------------------------------------------------------------------------
vi.mock("../../src/projects/storage", () => ({
  loadState: vi.fn(),
  upsertBundle: vi.fn(),
  deleteBundle: vi.fn(),
  setActiveProject: vi.fn(),
  setActiveVersion: vi.fn(),
  saveState: vi.fn(),
  getActiveProject: vi.fn(),
  getActiveVersion: vi.fn(),
  findVersion: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeVersion = (version: string): ProjectVersion => ({
  version,
  releasedAt: "2026-01-01T00:00:00Z",
  releaseNotes: "Release notes",
  changes: [],
  blocks: [],
  scenarios: [],
  environments: [],
  docs: {},
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

describe("makeInitialProjectsState", () => {
  it("returns empty state", () => {
    const state = makeInitialProjectsState();
    expect(state.bundles).toEqual([]);
    expect(state.activeProjectId).toBeNull();
    expect(state.activeVersionByProject).toEqual({});
  });
});

describe("projectsReducer — LOAD", () => {
  it("replaces entire state with payload", () => {
    const initial = makeInitialProjectsState();
    const bundle = makeBundle("p1");
    const payload: ProjectsState = {
      bundles: [bundle],
      activeProjectId: "p1",
      activeVersionByProject: { p1: "1.0.0" },
    };
    const next = projectsReducer(initial, { type: "LOAD", payload });
    expect(next).toEqual(payload);
  });

  it("LOAD over non-empty state replaces fully", () => {
    const withData: ProjectsState = {
      bundles: [makeBundle("old")],
      activeProjectId: "old",
      activeVersionByProject: { old: "1.0.0" },
    };
    const newPayload: ProjectsState = {
      bundles: [],
      activeProjectId: null,
      activeVersionByProject: {},
    };
    const next = projectsReducer(withData, { type: "LOAD", payload: newPayload });
    expect(next.bundles).toHaveLength(0);
    expect(next.activeProjectId).toBeNull();
  });
});

describe("projectsReducer — UPSERT_BUNDLE", () => {
  let base: ProjectsState;
  beforeEach(() => {
    base = makeInitialProjectsState();
  });

  it("adds a new bundle when id is not present", () => {
    const bundle = makeBundle("p1");
    const next = projectsReducer(base, { type: "UPSERT_BUNDLE", payload: bundle });
    expect(next.bundles).toHaveLength(1);
    expect(next.bundles[0].id).toBe("p1");
  });

  it("replaces existing bundle when id matches", () => {
    const state: ProjectsState = {
      bundles: [makeBundle("p1", { name: "Old Name" })],
      activeProjectId: null,
      activeVersionByProject: {},
    };
    const updated = makeBundle("p1", { name: "New Name" });
    const next = projectsReducer(state, { type: "UPSERT_BUNDLE", payload: updated });
    expect(next.bundles).toHaveLength(1);
    expect(next.bundles[0].name).toBe("New Name");
  });

  it("preserves other bundles on upsert", () => {
    const state: ProjectsState = {
      bundles: [makeBundle("p1"), makeBundle("p2")],
      activeProjectId: null,
      activeVersionByProject: {},
    };
    const updated = makeBundle("p1", { name: "Updated p1" });
    const next = projectsReducer(state, { type: "UPSERT_BUNDLE", payload: updated });
    expect(next.bundles).toHaveLength(2);
    expect(next.bundles.find((b) => b.id === "p2")).toBeDefined();
  });
});

describe("projectsReducer — DELETE_BUNDLE", () => {
  it("removes the bundle with matching id", () => {
    const state: ProjectsState = {
      bundles: [makeBundle("p1"), makeBundle("p2")],
      activeProjectId: null,
      activeVersionByProject: {},
    };
    const next = projectsReducer(state, { type: "DELETE_BUNDLE", payload: "p1" });
    expect(next.bundles).toHaveLength(1);
    expect(next.bundles[0].id).toBe("p2");
  });

  it("clears activeProjectId when deleting the active project", () => {
    const state: ProjectsState = {
      bundles: [makeBundle("p1")],
      activeProjectId: "p1",
      activeVersionByProject: {},
    };
    const next = projectsReducer(state, { type: "DELETE_BUNDLE", payload: "p1" });
    expect(next.activeProjectId).toBeNull();
  });

  it("preserves activeProjectId when deleting a different project", () => {
    const state: ProjectsState = {
      bundles: [makeBundle("p1"), makeBundle("p2")],
      activeProjectId: "p2",
      activeVersionByProject: {},
    };
    const next = projectsReducer(state, { type: "DELETE_BUNDLE", payload: "p1" });
    expect(next.activeProjectId).toBe("p2");
  });

  it("removes the deleted bundle's activeVersionByProject entry", () => {
    const state: ProjectsState = {
      bundles: [makeBundle("p1"), makeBundle("p2")],
      activeProjectId: null,
      activeVersionByProject: { p1: "1.0.0", p2: "2.0.0" },
    };
    const next = projectsReducer(state, { type: "DELETE_BUNDLE", payload: "p1" });
    expect(next.activeVersionByProject).not.toHaveProperty("p1");
    expect(next.activeVersionByProject).toHaveProperty("p2", "2.0.0");
  });
});

describe("projectsReducer — SET_ACTIVE_PROJECT", () => {
  it("sets activeProjectId to provided id", () => {
    const state: ProjectsState = {
      bundles: [makeBundle("p1")],
      activeProjectId: null,
      activeVersionByProject: {},
    };
    const next = projectsReducer(state, { type: "SET_ACTIVE_PROJECT", payload: "p1" });
    expect(next.activeProjectId).toBe("p1");
  });

  it("sets activeProjectId to null when passed null", () => {
    const state: ProjectsState = {
      bundles: [makeBundle("p1")],
      activeProjectId: "p1",
      activeVersionByProject: {},
    };
    const next = projectsReducer(state, { type: "SET_ACTIVE_PROJECT", payload: null });
    expect(next.activeProjectId).toBeNull();
  });
});

describe("projectsReducer — SET_ACTIVE_VERSION", () => {
  it("sets the version for the given projectId", () => {
    const state: ProjectsState = {
      bundles: [makeBundle("p1", { versions: [makeVersion("1.0.0"), makeVersion("2.0.0")] })],
      activeProjectId: "p1",
      activeVersionByProject: {},
    };
    const next = projectsReducer(state, {
      type: "SET_ACTIVE_VERSION",
      payload: { projectId: "p1", version: "2.0.0" },
    });
    expect(next.activeVersionByProject["p1"]).toBe("2.0.0");
  });

  it("preserves existing version entries for other projects", () => {
    const state: ProjectsState = {
      bundles: [makeBundle("p1"), makeBundle("p2")],
      activeProjectId: null,
      activeVersionByProject: { p2: "1.0.0" },
    };
    const next = projectsReducer(state, {
      type: "SET_ACTIVE_VERSION",
      payload: { projectId: "p1", version: "3.0.0" },
    });
    expect(next.activeVersionByProject["p1"]).toBe("3.0.0");
    expect(next.activeVersionByProject["p2"]).toBe("1.0.0");
  });
});
