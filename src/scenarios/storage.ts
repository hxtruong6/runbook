// src/scenarios/storage.ts
import { ScenariosSchema, type Scenario } from "./types";

const KEY = "chairside-runner:scenarios";

export function loadScenarios(): Scenario[] {
  const raw = localStorage.getItem(KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    const result = ScenariosSchema.safeParse(parsed);
    return result.success ? result.data : [];
  } catch {
    return [];
  }
}

export function saveScenarios(scenarios: Scenario[]): void {
  localStorage.setItem(KEY, JSON.stringify(scenarios));
}

export function upsertScenario(scenario: Scenario): void {
  const all = loadScenarios();
  const idx = all.findIndex((s) => s.id === scenario.id);
  if (idx >= 0) all[idx] = scenario;
  else all.push(scenario);
  saveScenarios(all);
}

export function deleteScenario(id: string): void {
  saveScenarios(loadScenarios().filter((s) => s.id !== id));
}
