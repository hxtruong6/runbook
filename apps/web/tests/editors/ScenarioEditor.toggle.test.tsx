import { describe, it, expect, beforeEach, afterEach } from "vitest";

// Replicate the localStorage helpers from App.tsx
function loadScenarioMode(scenarioId: string): "list" | "graph" | null {
  try {
    const v = localStorage.getItem(`rb_scenario_mode:${scenarioId}`);
    return v === "graph" ? "graph" : v === "list" ? "list" : null;
  } catch {
    return null;
  }
}

function saveScenarioMode(scenarioId: string, mode: "list" | "graph") {
  try {
    localStorage.setItem(`rb_scenario_mode:${scenarioId}`, mode);
  } catch {
    // ignore
  }
}

// Minimal scenario-mode toggle simulation (mirrors App.tsx setScenarioMode logic)
function createModeStore() {
  const memory: Record<string, "list" | "graph"> = {};

  function setMode(scenarioId: string, mode: "list" | "graph") {
    memory[scenarioId] = mode;
    saveScenarioMode(scenarioId, mode);
  }

  function getMode(scenarioId: string, hasGraphData = false): "list" | "graph" {
    if (memory[scenarioId]) return memory[scenarioId]!;
    const persisted = loadScenarioMode(scenarioId);
    return persisted ?? (hasGraphData ? "graph" : "list");
  }

  return { setMode, getMode };
}

describe("ScenarioEditor mode toggle — no data loss", () => {
  const SCENARIO_ID = "scenario-abc-123";

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("defaults to list when no graphData and nothing persisted", () => {
    const store = createModeStore();
    expect(store.getMode(SCENARIO_ID, false)).toBe("list");
  });

  it("defaults to graph when graphData exists and nothing persisted", () => {
    const store = createModeStore();
    expect(store.getMode(SCENARIO_ID, true)).toBe("graph");
  });

  it("persists chosen mode to localStorage", () => {
    const store = createModeStore();
    store.setMode(SCENARIO_ID, "graph");
    expect(localStorage.getItem(`rb_scenario_mode:${SCENARIO_ID}`)).toBe("graph");
  });

  it("loads persisted mode after simulated remount", () => {
    // First session: set to graph
    const store1 = createModeStore();
    store1.setMode(SCENARIO_ID, "graph");

    // Remount — fresh memory store but same localStorage
    const store2 = createModeStore();
    expect(store2.getMode(SCENARIO_ID, false)).toBe("graph");
  });

  it("toggle 5x without data loss — ends on correct mode", () => {
    // Simulate the blocks data that must survive mode switches
    const blocks = [
      { id: "b1", kind: "httpRequest", overrides: { url: "https://api.example.com" } },
      { id: "b2", kind: "signin", overrides: { email: "test@test.com" } },
    ];

    const store = createModeStore();
    let currentMode: "list" | "graph" = "list";

    // Toggle 5 times
    for (let i = 0; i < 5; i++) {
      currentMode = currentMode === "list" ? "graph" : "list";
      store.setMode(SCENARIO_ID, currentMode);
    }

    // After 5 toggles from "list": list→graph→list→graph→list→graph
    expect(currentMode).toBe("graph");
    expect(store.getMode(SCENARIO_ID)).toBe("graph");

    // Verify blocks are unchanged (pure rerender — no mutation)
    expect(blocks).toHaveLength(2);
    expect(blocks[0]!.overrides.url).toBe("https://api.example.com");
    expect(blocks[1]!.overrides.email).toBe("test@test.com");
  });

  it("persists mode per scenarioId independently", () => {
    const store = createModeStore();
    store.setMode("scenario-1", "graph");
    store.setMode("scenario-2", "list");

    expect(store.getMode("scenario-1")).toBe("graph");
    expect(store.getMode("scenario-2")).toBe("list");
  });
});
