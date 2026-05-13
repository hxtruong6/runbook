// tests/scenarios/storage.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { loadScenarios, saveScenarios, upsertScenario, deleteScenario } from "../../src/scenarios/storage";

describe("scenarios/storage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns [] when nothing is stored", () => {
    expect(loadScenarios()).toEqual([]);
  });

  it("saveScenarios + loadScenarios round-trips", () => {
    const s = { id: "1", name: "x", createdAt: "2026-05-12T00:00:00Z", blocks: [], reusable: false };
    saveScenarios([s]);
    expect(loadScenarios()).toEqual([s]);
  });

  it("upsertScenario adds new and replaces by id", () => {
    upsertScenario({ id: "1", name: "a", createdAt: "t", blocks: [] });
    upsertScenario({ id: "2", name: "b", createdAt: "t", blocks: [] });
    upsertScenario({ id: "1", name: "a2", createdAt: "t", blocks: [] });
    const all = loadScenarios();
    expect(all).toHaveLength(2);
    expect(all.find((s) => s.id === "1")!.name).toBe("a2");
  });

  it("deleteScenario removes by id", () => {
    upsertScenario({ id: "1", name: "a", createdAt: "t", blocks: [] });
    deleteScenario("1");
    expect(loadScenarios()).toEqual([]);
  });

  it("returns [] when stored data is invalid JSON or bad shape", () => {
    localStorage.setItem("chairside-runner:scenarios", "not json");
    expect(loadScenarios()).toEqual([]);
    localStorage.setItem("chairside-runner:scenarios", JSON.stringify([{ bogus: true }]));
    expect(loadScenarios()).toEqual([]);
  });
});
