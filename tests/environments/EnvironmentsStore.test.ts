// tests/environments/EnvironmentsStore.test.ts
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { environmentsReducer, makeInitialEnvState } from "../../src/environments/EnvironmentsStore";
import type { EnvironmentsState, Environment } from "../../src/environments/types";

const makeEnv = (overrides: Partial<Environment> = {}): Environment => ({
  id: "env-1",
  name: "Test Env",
  baseUrl: "https://api.example.com",
  auth: { kind: "none" },
  headers: {},
  createdAt: "2026-05-12T00:00:00Z",
  ...overrides,
});

// ─── Reducer tests ────────────────────────────────────────────────────────────
describe("environmentsReducer", () => {
  let state: EnvironmentsState;

  beforeEach(() => {
    state = makeInitialEnvState();
  });

  it("LOAD replaces the entire state", () => {
    const env = makeEnv({ id: "env-1" });
    const loaded: EnvironmentsState = { environments: [env], activeId: "env-1" };
    const next = environmentsReducer(state, { type: "LOAD", state: loaded });
    expect(next).toEqual(loaded);
  });

  it("UPSERT adds a new environment", () => {
    const env = makeEnv({ id: "env-1" });
    const next = environmentsReducer(state, { type: "UPSERT", env });
    expect(next.environments).toHaveLength(1);
    expect(next.environments[0]).toEqual(env);
  });

  it("UPSERT replaces an existing environment with the same id", () => {
    const original = makeEnv({ id: "env-1", name: "Original" });
    const s1 = environmentsReducer(state, { type: "UPSERT", env: original });
    const updated = makeEnv({ id: "env-1", name: "Updated" });
    const s2 = environmentsReducer(s1, { type: "UPSERT", env: updated });
    expect(s2.environments).toHaveLength(1);
    expect(s2.environments[0].name).toBe("Updated");
  });

  it("DELETE removes the environment by id", () => {
    const env1 = makeEnv({ id: "env-1" });
    const env2 = makeEnv({ id: "env-2", name: "Second" });
    let s = environmentsReducer(state, { type: "UPSERT", env: env1 });
    s = environmentsReducer(s, { type: "UPSERT", env: env2 });
    s = environmentsReducer(s, { type: "DELETE", id: "env-1" });
    expect(s.environments).toHaveLength(1);
    expect(s.environments[0].id).toBe("env-2");
  });

  it("DELETE clears activeId when it matches the deleted id", () => {
    const env = makeEnv({ id: "env-1" });
    let s = environmentsReducer(state, { type: "UPSERT", env });
    s = environmentsReducer(s, { type: "SET_ACTIVE", id: "env-1" });
    s = environmentsReducer(s, { type: "DELETE", id: "env-1" });
    expect(s.activeId).toBeNull();
  });

  it("DELETE does NOT clear activeId when deleting a different env", () => {
    const env1 = makeEnv({ id: "env-1" });
    const env2 = makeEnv({ id: "env-2", name: "Second" });
    let s = environmentsReducer(state, { type: "UPSERT", env: env1 });
    s = environmentsReducer(s, { type: "UPSERT", env: env2 });
    s = environmentsReducer(s, { type: "SET_ACTIVE", id: "env-2" });
    s = environmentsReducer(s, { type: "DELETE", id: "env-1" });
    expect(s.activeId).toBe("env-2");
  });

  it("SET_ACTIVE sets the activeId", () => {
    const env = makeEnv({ id: "env-1" });
    let s = environmentsReducer(state, { type: "UPSERT", env });
    s = environmentsReducer(s, { type: "SET_ACTIVE", id: "env-1" });
    expect(s.activeId).toBe("env-1");
  });

  it("SET_ACTIVE with null clears activeId", () => {
    const env = makeEnv({ id: "env-1" });
    let s = environmentsReducer(state, { type: "UPSERT", env });
    s = environmentsReducer(s, { type: "SET_ACTIVE", id: "env-1" });
    s = environmentsReducer(s, { type: "SET_ACTIVE", id: null });
    expect(s.activeId).toBeNull();
  });
});

// ─── Persistence tests (mock localStorage) ───────────────────────────────────
describe("environmentsReducer – persistence side effects", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("UPSERT calls saveState (localStorage.setItem is invoked)", () => {
    const spy = vi.spyOn(Storage.prototype, "setItem");
    const env = makeEnv({ id: "env-1" });
    const s = makeInitialEnvState();
    environmentsReducer(s, { type: "UPSERT", env });
    expect(spy).toHaveBeenCalled();
  });

  it("DELETE calls saveState (localStorage.setItem is invoked)", () => {
    const env = makeEnv({ id: "env-1" });
    const s = environmentsReducer(makeInitialEnvState(), { type: "UPSERT", env });
    const spy = vi.spyOn(Storage.prototype, "setItem");
    environmentsReducer(s, { type: "DELETE", id: "env-1" });
    expect(spy).toHaveBeenCalled();
  });

  it("SET_ACTIVE calls saveState (localStorage.setItem is invoked)", () => {
    const spy = vi.spyOn(Storage.prototype, "setItem");
    environmentsReducer(makeInitialEnvState(), { type: "SET_ACTIVE", id: "env-1" });
    expect(spy).toHaveBeenCalled();
  });
});
