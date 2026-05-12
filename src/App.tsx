// src/App.tsx
import { useEffect, useState } from "react";
import { loadScenarios, saveScenarios, upsertScenario } from "./scenarios/storage";
import { PREBUILT_SCENARIOS } from "./scenarios/prebuilt";
import type { Scenario } from "./scenarios/types";
import { BlockCard } from "./components/BlockCard";
import { ContextPanel } from "./components/ContextPanel";
import { TopBar } from "./components/TopBar";
import { useRuntimeContext } from "./context/ContextStore";
import { runScenarioFrom } from "./execution/runScenario";

export function App() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const { context, dispatch } = useRuntimeContext();

  useEffect(() => {
    let loaded = loadScenarios();
    if (loaded.length === 0) {
      saveScenarios(PREBUILT_SCENARIOS);
      loaded = PREBUILT_SCENARIOS;
    }
    setScenarios(loaded);
    setActiveId(loaded[0]?.id ?? null);
  }, []);

  const active = scenarios.find((s) => s.id === activeId) ?? null;

  function updateActive(next: Scenario) {
    setScenarios((all) => all.map((s) => (s.id === next.id ? next : s)));
    upsertScenario(next);
  }

  async function runFrom(startIdx: number) {
    if (!active) return;
    await runScenarioFrom(active.blocks, startIdx, context, (newCtx) => {
      dispatch({ type: "MERGE", values: newCtx });
    });
  }

  function importScenario(s: Scenario) {
    setScenarios((all) => [...all, s]);
    upsertScenario(s);
    setActiveId(s.id);
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <h2>Scenarios</h2>
        <button
          className="btn"
          style={{ width: "100%", marginBottom: 12 }}
          onClick={() => {
            saveScenarios(PREBUILT_SCENARIOS);
            setScenarios(PREBUILT_SCENARIOS);
            setActiveId(PREBUILT_SCENARIOS[0]?.id ?? null);
          }}
        >
          Reset to prebuilt
        </button>
        <ul>
          {scenarios.map((s) => (
            <li key={s.id}>
              <button
                className={s.id === activeId ? "active" : ""}
                onClick={() => setActiveId(s.id)}
              >
                {s.name}
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <main className="main">
        <TopBar active={active} onRunAll={() => runFrom(0)} onImport={importScenario} />
        <section className="blocks">
          {active ? (
            active.blocks.map((b, i) => (
              <BlockCard
                key={b.id}
                block={b}
                onChange={(next) => {
                  const updatedBlocks = [...active.blocks];
                  updatedBlocks[i] = next;
                  updateActive({ ...active, blocks: updatedBlocks });
                }}
                onRunFromHere={() => runFrom(i)}
              />
            ))
          ) : (
            <p>Select a scenario from the left.</p>
          )}
        </section>
      </main>

      <aside className="context">
        <h2>Context</h2>
        <ContextPanel />
      </aside>
    </div>
  );
}
