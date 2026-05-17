// Persists inference observations keyed by block kind in localStorage.
// Kept separate from the block defs themselves so it works for both
// local (user-created) and built-in blocks.
import { captureFromResult, type BlockInference } from "@runbook/shared";
import type { BlockRunResult } from "../blocks/types";

const KEY = "runbook:inference";
const SETTINGS_KEY = "runbook:inference-settings";

type Store = Record<string, BlockInference>;

function load(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Store) : {};
  } catch {
    return {};
  }
}

function save(store: Store): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* quota — silently drop */
  }
}

export function getInferenceFor(kind: string): BlockInference | undefined {
  return load()[kind];
}

export function getAllInference(): Store {
  return load();
}

export type CaptureOutcome = {
  kind: string;
  family: "2xx" | "4xx" | "5xx";
  isNew: boolean; // true if this block had no prior inference
  driftCount: number;
  next: BlockInference;
};

// Auto-capture from a single run result. Returns an outcome the caller can
// surface in UI (banner, badge, etc.), or null when nothing was captured.
export function captureRun(kind: string, result: BlockRunResult): CaptureOutcome | null {
  if (!isInferenceEnabled()) return null;
  if (result.status === "ok" || result.status === "err") {
    const httpStatus = "httpStatus" in result ? result.httpStatus : undefined;
    const body = "response" in result ? result.response : null;
    const store = load();
    const prev = store[kind];
    const cap = captureFromResult(prev, { httpStatus, body });
    if (!cap) return null;
    store[kind] = cap.next;
    save(store);
    return {
      kind,
      family: cap.observation.family as "2xx" | "4xx" | "5xx",
      isNew: !prev,
      driftCount: cap.drift.length,
      next: cap.next,
    };
  }
  return null;
}

export function clearInferenceFor(kind: string): void {
  const store = load();
  delete store[kind];
  save(store);
}

// ---- Settings ----------------------------------------------------------

type Settings = { enabled: boolean };

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { enabled: true };
    const parsed = JSON.parse(raw);
    return { enabled: parsed?.enabled !== false };
  } catch {
    return { enabled: true };
  }
}

function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

export function isInferenceEnabled(): boolean {
  return loadSettings().enabled;
}

export function setInferenceEnabled(enabled: boolean): void {
  saveSettings({ enabled });
}
