// src/projects/storage.ts
import {
  ProjectsStateSchema,
  type ProjectBundle,
  type ProjectsState,
  type ProjectVersion,
} from "./types";

const KEY = "chairside-runner:projects";

const emptyState = (): ProjectsState => ({
  bundles: [],
  activeProjectId: null,
  activeVersionByProject: {},
});

export function loadState(): ProjectsState {
  const raw = localStorage.getItem(KEY);
  if (!raw) return emptyState();
  try {
    const parsed = JSON.parse(raw);
    const result = ProjectsStateSchema.safeParse(parsed);
    return result.success ? result.data : emptyState();
  } catch {
    return emptyState();
  }
}

export function saveState(state: ProjectsState): void {
  localStorage.setItem(KEY, JSON.stringify(state));
}

export function upsertBundle(bundle: ProjectBundle): void {
  const state = loadState();
  const idx = state.bundles.findIndex((b) => b.id === bundle.id);
  if (idx >= 0) state.bundles[idx] = bundle;
  else state.bundles.push(bundle);
  saveState(state);
}

export function deleteBundle(id: string): void {
  const state = loadState();
  state.bundles = state.bundles.filter((b) => b.id !== id);
  if (state.activeProjectId === id) state.activeProjectId = null;
  delete state.activeVersionByProject[id];
  saveState(state);
}

export function setActiveProject(id: string | null): void {
  const state = loadState();
  state.activeProjectId = id;
  saveState(state);
}

export function setActiveVersion(projectId: string, version: string): void {
  const state = loadState();
  state.activeVersionByProject[projectId] = version;
  saveState(state);
}

export function getActiveProject(): ProjectBundle | null {
  const state = loadState();
  if (!state.activeProjectId) return null;
  return state.bundles.find((b) => b.id === state.activeProjectId) ?? null;
}

/**
 * Find a version by its version string within a bundle.
 * Returns null if not found.
 */
export function findVersion(bundle: ProjectBundle, version: string): ProjectVersion | null {
  return bundle.versions.find((v) => v.version === version) ?? null;
}

/**
 * Returns the active version for the active project:
 * - null if no active project
 * - The explicitly chosen version if it exists in the bundle
 * - Falls back to versions[0] (conventionally newest) if:
 *   - No explicit version is set, OR
 *   - The chosen version no longer exists in the bundle
 * - null if the active project has no versions at all
 */
export function getActiveVersion(): ProjectVersion | null {
  const state = loadState();
  if (!state.activeProjectId) return null;

  const bundle = state.bundles.find((b) => b.id === state.activeProjectId);
  if (!bundle || bundle.versions.length === 0) return null;

  const chosenVersion = state.activeVersionByProject[state.activeProjectId];
  if (chosenVersion) {
    const found = findVersion(bundle, chosenVersion);
    if (found) return found;
    // chosen version no longer exists — fall back to versions[0]
    return bundle.versions[0];
  }

  // No explicit version set — return newest (versions[0] by convention)
  return bundle.versions[0];
}
