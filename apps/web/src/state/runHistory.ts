/**
 * runHistory — Zustand store for per-scenario run results (UX-D3)
 *
 * Shape:
 *   results: Record<scenarioId, RunResultEntry[]>  — newest first, capped at MAX_PER_SCENARIO
 *
 * Persisted to localStorage under key `rb_run_history` via Zustand's persist middleware.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { BlockRunResult } from "../blocks/types";

export const MAX_PER_SCENARIO = 5;
export const STORAGE_KEY = "rb_run_history";

export type RunResultEntry = {
  id: string;           // crypto.randomUUID()
  runAt: string;        // ISO timestamp
  /** Shallow snapshot of all block results from the run */
  blockResults: BlockRunResult[];
  /** Top-level response captured from the last successful block (convenience) */
  lastResponse: unknown;
};

type RunHistoryState = {
  /** Map of scenarioId → recent run results (newest first) */
  results: Record<string, RunResultEntry[]>;

  /** Push a new result for a scenario; evicts oldest if over cap */
  pushResult: (scenarioId: string, entry: RunResultEntry) => void;

  /** Get ordered results for a scenario (newest first) */
  getResults: (scenarioId: string) => RunResultEntry[];

  /** Clear history for a specific scenario */
  clearScenario: (scenarioId: string) => void;
};

export const useRunHistoryStore = create<RunHistoryState>()(
  persist(
    (set, get) => ({
      results: {},

      pushResult(scenarioId, entry) {
        set((state) => {
          const existing = state.results[scenarioId] ?? [];
          const updated = [entry, ...existing].slice(0, MAX_PER_SCENARIO);
          return { results: { ...state.results, [scenarioId]: updated } };
        });
      },

      getResults(scenarioId) {
        return get().results[scenarioId] ?? [];
      },

      clearScenario(scenarioId) {
        set((state) => {
          const next = { ...state.results };
          delete next[scenarioId];
          return { results: next };
        });
      },
    }),
    {
      name: STORAGE_KEY,
    },
  ),
);
