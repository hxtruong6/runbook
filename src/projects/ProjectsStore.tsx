// src/projects/ProjectsStore.tsx
import { createContext, useContext, useReducer, useEffect, type ReactNode } from "react";
import type { ProjectBundle, ProjectsState, ProjectVersion } from "./types";
import {
  loadState,
  upsertBundle,
  deleteBundle,
  setActiveProject,
  setActiveVersion,
} from "./storage";
import sampleBundleJson from "../../samples/32co-chairside.bundle.json";
import { ProjectBundleSchema } from "./types";

const sampleBundle: ProjectBundle = ProjectBundleSchema.parse(sampleBundleJson);

// ─── Action types ──────────────────────────────────────────────────────────────
export type ProjectsAction =
  | { type: "LOAD"; payload: ProjectsState }
  | { type: "UPSERT_BUNDLE"; payload: ProjectBundle }
  | { type: "DELETE_BUNDLE"; payload: string }
  | { type: "SET_ACTIVE_PROJECT"; payload: string | null }
  | { type: "SET_ACTIVE_VERSION"; payload: { projectId: string; version: string } };

// ─── Initial state helper ──────────────────────────────────────────────────────
export function makeInitialProjectsState(): ProjectsState {
  return { bundles: [], activeProjectId: null, activeVersionByProject: {} };
}

// ─── Reducer ───────────────────────────────────────────────────────────────────
export function projectsReducer(
  state: ProjectsState,
  action: ProjectsAction
): ProjectsState {
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
      const next = { ...state, bundles };
      upsertBundle(bundle);
      return next;
    }

    case "DELETE_BUNDLE": {
      const id = action.payload;
      const bundles = state.bundles.filter((b) => b.id !== id);
      const activeProjectId = state.activeProjectId === id ? null : state.activeProjectId;
      const activeVersionByProject = { ...state.activeVersionByProject };
      delete activeVersionByProject[id];
      const next = { ...state, bundles, activeProjectId, activeVersionByProject };
      deleteBundle(id);
      return next;
    }

    case "SET_ACTIVE_PROJECT": {
      const next = { ...state, activeProjectId: action.payload };
      setActiveProject(action.payload);
      return next;
    }

    case "SET_ACTIVE_VERSION": {
      const { projectId, version } = action.payload;
      const next = {
        ...state,
        activeVersionByProject: { ...state.activeVersionByProject, [projectId]: version },
      };
      setActiveVersion(projectId, version);
      return next;
    }
  }
}

// ─── Context ───────────────────────────────────────────────────────────────────
type StoreValue = {
  state: ProjectsState;
  dispatch: React.Dispatch<ProjectsAction>;
  activeProject: ProjectBundle | null;
  activeVersion: ProjectVersion | null;
};

const ProjectsCtx = createContext<StoreValue | null>(null);

// ─── Provider ──────────────────────────────────────────────────────────────────
export function ProjectsStoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(
    projectsReducer,
    undefined,
    makeInitialProjectsState
  );

  useEffect(() => {
    const loadedState = loadState();
    dispatch({ type: "LOAD", payload: loadedState });
    if (loadedState.bundles.length === 0) {
      dispatch({ type: "UPSERT_BUNDLE", payload: sampleBundle });
      dispatch({ type: "SET_ACTIVE_PROJECT", payload: sampleBundle.id });
    }
  }, []);

  const activeProject =
    state.activeProjectId != null
      ? (state.bundles.find((b) => b.id === state.activeProjectId) ?? null)
      : null;

  let activeVersion: ProjectVersion | null = null;
  if (activeProject) {
    const chosenVersionStr = state.activeVersionByProject[activeProject.id];
    if (chosenVersionStr) {
      const found = activeProject.versions.find((v) => v.version === chosenVersionStr);
      activeVersion = found ?? activeProject.versions[0] ?? null;
    } else {
      activeVersion = activeProject.versions[0] ?? null;
    }
  }

  return (
    <ProjectsCtx.Provider value={{ state, dispatch, activeProject, activeVersion }}>
      {children}
    </ProjectsCtx.Provider>
  );
}

// ─── Hook ──────────────────────────────────────────────────────────────────────
export function useProjects(): StoreValue {
  const v = useContext(ProjectsCtx);
  if (!v) throw new Error("useProjects must be inside ProjectsStoreProvider");
  return v;
}
