// tests/environments/storage.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import {
  loadState,
  saveState,
  upsertEnvironment,
  deleteEnvironment,
  setActiveId,
  getActiveEnvironment,
} from "../../src/environments/storage";
import type { Environment, EnvironmentsState } from "../../src/environments/types";

const STORAGE_KEY = "chairside-runner:environments";

const makeEnv = (overrides: Partial<Environment> = {}): Environment => ({
  id: "env-1",
  name: "Test Env",
  baseUrl: "https://api.example.com",
  auth: { kind: "none" },
  headers: {},
  createdAt: "2026-05-12T00:00:00Z",
  ...overrides,
});

describe("environments/storage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns default empty state when nothing is stored", () => {
    expect(loadState()).toEqual({ environments: [], activeId: null });
  });

  it("saveState + loadState round-trips correctly", () => {
    const env = makeEnv();
    const state: EnvironmentsState = { environments: [env], activeId: "env-1" };
    saveState(state);
    expect(loadState()).toEqual(state);
  });

  it("upsertEnvironment adds a new environment", () => {
    const env = makeEnv();
    upsertEnvironment(env);
    const state = loadState();
    expect(state.environments).toHaveLength(1);
    expect(state.environments[0]).toEqual(env);
  });

  it("upsertEnvironment replaces environment with same id", () => {
    upsertEnvironment(makeEnv({ name: "Original" }));
    upsertEnvironment(makeEnv({ name: "Updated" }));
    const state = loadState();
    expect(state.environments).toHaveLength(1);
    expect(state.environments[0].name).toBe("Updated");
  });

  it("upsertEnvironment adds a second distinct environment", () => {
    upsertEnvironment(makeEnv({ id: "env-1", name: "First" }));
    upsertEnvironment(makeEnv({ id: "env-2", name: "Second" }));
    expect(loadState().environments).toHaveLength(2);
  });

  it("deleteEnvironment removes by id", () => {
    upsertEnvironment(makeEnv({ id: "env-1" }));
    upsertEnvironment(makeEnv({ id: "env-2", name: "Other" }));
    deleteEnvironment("env-1");
    const state = loadState();
    expect(state.environments).toHaveLength(1);
    expect(state.environments[0].id).toBe("env-2");
  });

  it("deleteEnvironment clears activeId when it matches the deleted id", () => {
    upsertEnvironment(makeEnv({ id: "env-1" }));
    setActiveId("env-1");
    deleteEnvironment("env-1");
    expect(loadState().activeId).toBeNull();
  });

  it("deleteEnvironment does NOT clear activeId when deleting a different env", () => {
    upsertEnvironment(makeEnv({ id: "env-1" }));
    upsertEnvironment(makeEnv({ id: "env-2", name: "Other" }));
    setActiveId("env-2");
    deleteEnvironment("env-1");
    expect(loadState().activeId).toBe("env-2");
  });

  it("setActiveId persists the active id", () => {
    setActiveId("env-1");
    expect(loadState().activeId).toBe("env-1");
  });

  it("setActiveId accepts null to clear the active id", () => {
    setActiveId("env-1");
    setActiveId(null);
    expect(loadState().activeId).toBeNull();
  });

  it("getActiveEnvironment returns null when no activeId", () => {
    upsertEnvironment(makeEnv({ id: "env-1" }));
    expect(getActiveEnvironment()).toBeNull();
  });

  it("getActiveEnvironment returns the active environment when it exists", () => {
    const env = makeEnv({ id: "env-1" });
    upsertEnvironment(env);
    setActiveId("env-1");
    expect(getActiveEnvironment()).toEqual(env);
  });

  it("getActiveEnvironment returns null when activeId does not match any env", () => {
    upsertEnvironment(makeEnv({ id: "env-1" }));
    setActiveId("env-999");
    expect(getActiveEnvironment()).toBeNull();
  });

  it("loadState returns default when stored JSON is malformed", () => {
    localStorage.setItem(STORAGE_KEY, "not valid json {{{");
    expect(loadState()).toEqual({ environments: [], activeId: null });
  });

  it("loadState returns default when stored shape is wrong", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ bogus: true }));
    expect(loadState()).toEqual({ environments: [], activeId: null });
  });
});
