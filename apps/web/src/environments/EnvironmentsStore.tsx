// src/environments/EnvironmentsStore.tsx
import { createContext, useContext, useReducer, useEffect, type ReactNode } from "react";
import type { EnvironmentsState, Environment } from "./types";
import { loadState, saveState } from "./storage";
// ─── Action types ─────────────────────────────────────────────────────────────
export type EnvironmentsAction =
  | { type: "LOAD"; state: EnvironmentsState }
  | { type: "UPSERT"; env: Environment }
  | { type: "DELETE"; id: string }
  | { type: "SET_ACTIVE"; id: string | null };

// ─── Initial state helper ─────────────────────────────────────────────────────
export function makeInitialEnvState(): EnvironmentsState {
  return { environments: [], activeId: null };
}

// ─── Reducer ──────────────────────────────────────────────────────────────────
export function environmentsReducer(
  state: EnvironmentsState,
  action: EnvironmentsAction
): EnvironmentsState {
  switch (action.type) {
    case "LOAD":
      return action.state;

    case "UPSERT": {
      const idx = state.environments.findIndex((e) => e.id === action.env.id);
      const environments =
        idx >= 0
          ? state.environments.map((e, i) => (i === idx ? action.env : e))
          : [...state.environments, action.env];
      const next = { ...state, environments };
      saveState(next);
      return next;
    }

    case "DELETE": {
      const environments = state.environments.filter((e) => e.id !== action.id);
      const activeId = state.activeId === action.id ? null : state.activeId;
      const next = { ...state, environments, activeId };
      saveState(next);
      return next;
    }

    case "SET_ACTIVE": {
      const next = { ...state, activeId: action.id };
      saveState(next);
      return next;
    }
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────
type StoreValue = {
  state: EnvironmentsState;
  dispatch: React.Dispatch<EnvironmentsAction>;
  activeEnv: Environment | null;
};

const EnvCtx = createContext<StoreValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────
export function EnvironmentsStoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(environmentsReducer, undefined, makeInitialEnvState);

  useEffect(() => {
    const stored = loadState();
    dispatch({ type: "LOAD", state: stored });
  }, []);

  const activeEnv =
    state.activeId != null
      ? (state.environments.find((e) => e.id === state.activeId) ?? null)
      : null;

  return (
    <EnvCtx.Provider value={{ state, dispatch, activeEnv }}>
      {children}
    </EnvCtx.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useEnvironments(): StoreValue {
  const v = useContext(EnvCtx);
  if (!v) throw new Error("useEnvironments must be inside EnvironmentsStoreProvider");
  return v;
}
