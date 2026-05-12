// src/environments/storage.ts
import { EnvironmentsStateSchema, type Environment, type EnvironmentsState } from "./types";

const KEY = "chairside-runner:environments";

const emptyState = (): EnvironmentsState => ({ environments: [], activeId: null });

export function loadState(): EnvironmentsState {
  const raw = localStorage.getItem(KEY);
  if (!raw) return emptyState();
  try {
    const parsed = JSON.parse(raw);
    const result = EnvironmentsStateSchema.safeParse(parsed);
    return result.success ? result.data : emptyState();
  } catch {
    return emptyState();
  }
}

export function saveState(state: EnvironmentsState): void {
  localStorage.setItem(KEY, JSON.stringify(state));
}

export function upsertEnvironment(env: Environment): void {
  const state = loadState();
  const idx = state.environments.findIndex((e) => e.id === env.id);
  if (idx >= 0) state.environments[idx] = env;
  else state.environments.push(env);
  saveState(state);
}

export function deleteEnvironment(id: string): void {
  const state = loadState();
  state.environments = state.environments.filter((e) => e.id !== id);
  if (state.activeId === id) state.activeId = null;
  saveState(state);
}

export function setActiveId(id: string | null): void {
  const state = loadState();
  state.activeId = id;
  saveState(state);
}

export function getActiveEnvironment(): Environment | null {
  const state = loadState();
  if (!state.activeId) return null;
  return state.environments.find((e) => e.id === state.activeId) ?? null;
}
