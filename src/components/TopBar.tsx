// src/components/TopBar.tsx
import type { Scenario } from "../scenarios/types";
import { downloadScenario, readScenarioFile } from "../scenarios/exportImport";

type Props = {
  active: Scenario | null;
  onRunAll: () => void;
  onImport: (s: Scenario) => void;
};

export function TopBar({ active, onRunAll, onImport }: Props) {
  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const s = await readScenarioFile(file);
      onImport({ ...s, id: crypto.randomUUID(), createdAt: new Date().toISOString() });
    } catch (err) {
      alert("Invalid scenario file: " + (err as Error).message);
    }
    e.target.value = "";
  }

  return (
    <header className="topbar">
      <h1>{active?.name ?? "No scenario"}</h1>
      <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
        <button className="btn primary" disabled={!active} onClick={onRunAll}>
          Run all
        </button>
        <button className="btn" disabled={!active} onClick={() => active && downloadScenario(active)}>
          Export
        </button>
        <label className="btn" style={{ cursor: "pointer" }}>
          Import
          <input type="file" accept="application/json" hidden onChange={handleImport} />
        </label>
      </div>
    </header>
  );
}
