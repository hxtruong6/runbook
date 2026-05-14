const MAX_HISTORY = 10;
const storageKey = (scenarioId: string) => `run-history:${scenarioId}`;

export type RunRecord = {
  id: string;        // crypto.randomUUID()
  runAt: string;     // ISO timestamp
  blockCount: number;
  passCount: number; // blocks with status "ok"
  failCount: number; // blocks with status "err"
  elapsedMs: number; // sum of all block elapsedMs
};

export function saveRunRecord(scenarioId: string, record: RunRecord): void {
  const existing = loadRunHistory(scenarioId);
  const updated = [record, ...existing].slice(0, MAX_HISTORY);
  localStorage.setItem(storageKey(scenarioId), JSON.stringify(updated));
}

export function loadRunHistory(scenarioId: string): RunRecord[] {
  try {
    const raw = localStorage.getItem(storageKey(scenarioId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function clearRunHistory(scenarioId: string): void {
  localStorage.removeItem(storageKey(scenarioId));
}
