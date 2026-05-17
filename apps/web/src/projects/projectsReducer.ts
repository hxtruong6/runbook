// src/projects/projectsReducer.ts
// Pure reducer + initial-state factory for ProjectsState (bundle-based state).
import type { ProjectBundle, ProjectsState } from "./types";

export type ProjectsAction =
  | { type: "LOAD"; payload: ProjectsState }
  | { type: "UPSERT_BUNDLE"; payload: ProjectBundle }
  | { type: "DELETE_BUNDLE"; payload: string }
  | { type: "SET_ACTIVE_PROJECT"; payload: string | null }
  | { type: "SET_ACTIVE_VERSION"; payload: { projectId: string; version: string } };

export function makeInitialProjectsState(): ProjectsState {
  return {
    bundles: [],
    activeProjectId: null,
    activeVersionByProject: {},
  };
}

export function projectsReducer(state: ProjectsState, action: ProjectsAction): ProjectsState {
  switch (action.type) {
    case "LOAD":
      return action.payload;

    case "UPSERT_BUNDLE": {
      const bundle = action.payload;
      const idx = state.bundles.findIndex((b) => b.id === bundle.id);
      const bundles =
        idx >= 0
          ? state.bundles.map((b, i) => (i === idx ? bundle : b))
          : [...state.bundles, bundle];
      return { ...state, bundles };
    }

    case "DELETE_BUNDLE": {
      const id = action.payload;
      const bundles = state.bundles.filter((b) => b.id !== id);
      const activeProjectId = state.activeProjectId === id ? null : state.activeProjectId;
      const activeVersionByProject = { ...state.activeVersionByProject };
      delete activeVersionByProject[id];
      return { ...state, bundles, activeProjectId, activeVersionByProject };
    }

    case "SET_ACTIVE_PROJECT":
      return { ...state, activeProjectId: action.payload };

    case "SET_ACTIVE_VERSION": {
      const { projectId, version } = action.payload;
      return {
        ...state,
        activeVersionByProject: { ...state.activeVersionByProject, [projectId]: version },
      };
    }

    default:
      return state;
  }
}
