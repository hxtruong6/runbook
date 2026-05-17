import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { RunDiff } from "../../src/features/runs/RunDiff";
import {
  useRunHistoryStore,
  MAX_PER_SCENARIO,
  type RunResultEntry,
} from "../../src/state/runHistory";
import type { BlockRunResult } from "../../src/blocks/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEntry(response: unknown, id = crypto.randomUUID()): RunResultEntry {
  const result: BlockRunResult = {
    status: "ok",
    httpStatus: 200,
    elapsedMs: 50,
    response,
    captured: {},
  };
  return {
    id,
    runAt: new Date().toISOString(),
    blockResults: [result],
    lastResponse: response,
  };
}

function renderDiff(current: RunResultEntry, previous: RunResultEntry) {
  return render(
    <MantineProvider>
      <RunDiff current={current} previous={previous} />
    </MantineProvider>,
  );
}

// ---------------------------------------------------------------------------
// RunDiff rendering tests
// ---------------------------------------------------------------------------

describe("RunDiff", () => {
  it("shows no-changes badge when responses are identical", () => {
    const entry = makeEntry({ id: 1, name: "Alice" });
    renderDiff(entry, entry);
    expect(screen.getByText(/no changes/i)).toBeInTheDocument();
  });

  it("reports added keys in DOM", () => {
    const prev = makeEntry({ id: 1 });
    const curr = makeEntry({ id: 1, name: "Bob" });
    renderDiff(curr, prev);

    const addedBadge = screen.getByTestId("diff-added");
    expect(addedBadge).toBeInTheDocument();
    expect(addedBadge.textContent).toMatch(/\+1 added/i);
  });

  it("reports removed keys in DOM", () => {
    const prev = makeEntry({ id: 1, name: "Bob" });
    const curr = makeEntry({ id: 1 });
    renderDiff(curr, prev);

    const removedBadge = screen.getByTestId("diff-removed");
    expect(removedBadge).toBeInTheDocument();
    expect(removedBadge.textContent).toMatch(/-1 removed/i);
  });

  it("reports changed keys in DOM", () => {
    const prev = makeEntry({ id: 1, status: "active" });
    const curr = makeEntry({ id: 1, status: "inactive" });
    renderDiff(curr, prev);

    const changedBadge = screen.getByTestId("diff-changed");
    expect(changedBadge).toBeInTheDocument();
    expect(changedBadge.textContent).toMatch(/~1 changed/i);
  });

  it("shows all three categories when they all exist", () => {
    const prev = makeEntry({ id: 1, status: "active", removed: true });
    const curr = makeEntry({ id: 1, status: "inactive", added: "yes" });
    renderDiff(curr, prev);

    expect(screen.getByTestId("diff-added")).toBeInTheDocument();
    expect(screen.getByTestId("diff-removed")).toBeInTheDocument();
    expect(screen.getByTestId("diff-changed")).toBeInTheDocument();
  });

  it("renders the diff container", () => {
    const prev = makeEntry({ a: 1 });
    const curr = makeEntry({ a: 2 });
    renderDiff(curr, prev);
    expect(screen.getByTestId("run-diff")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// runHistory store tests
// ---------------------------------------------------------------------------

describe("useRunHistoryStore", () => {
  const SCENARIO = "scenario-abc";

  beforeEach(() => {
    // Reset store state between tests
    useRunHistoryStore.setState({ results: {} });
  });

  it("stores a pushed result", () => {
    const entry = makeEntry({ ok: true });
    useRunHistoryStore.getState().pushResult(SCENARIO, entry);
    const results = useRunHistoryStore.getState().getResults(SCENARIO);
    expect(results).toHaveLength(1);
    expect(results[0]!.id).toBe(entry.id);
  });

  it("stores newest first", () => {
    const e1 = makeEntry({ n: 1 }, "id-1");
    const e2 = makeEntry({ n: 2 }, "id-2");
    useRunHistoryStore.getState().pushResult(SCENARIO, e1);
    useRunHistoryStore.getState().pushResult(SCENARIO, e2);
    const results = useRunHistoryStore.getState().getResults(SCENARIO);
    expect(results[0]!.id).toBe("id-2"); // newest first
    expect(results[1]!.id).toBe("id-1");
  });

  it(`caps at MAX_PER_SCENARIO (${MAX_PER_SCENARIO}) and evicts oldest`, () => {
    const ids: string[] = [];
    for (let i = 0; i < MAX_PER_SCENARIO + 3; i++) {
      const id = `id-${i}`;
      ids.push(id);
      useRunHistoryStore.getState().pushResult(SCENARIO, makeEntry({ i }, id));
    }

    const results = useRunHistoryStore.getState().getResults(SCENARIO);
    expect(results).toHaveLength(MAX_PER_SCENARIO);

    // newest (last pushed) should be first
    const lastId = ids[ids.length - 1];
    expect(results[0]!.id).toBe(lastId);

    // oldest entries should have been evicted
    const storedIds = results.map((r) => r.id);
    const evictedIds = ids.slice(0, ids.length - MAX_PER_SCENARIO);
    for (const evicted of evictedIds) {
      expect(storedIds).not.toContain(evicted);
    }
  });

  it("keeps results isolated per scenario", () => {
    useRunHistoryStore.getState().pushResult("s1", makeEntry({ s: 1 }));
    useRunHistoryStore.getState().pushResult("s2", makeEntry({ s: 2 }));
    expect(useRunHistoryStore.getState().getResults("s1")).toHaveLength(1);
    expect(useRunHistoryStore.getState().getResults("s2")).toHaveLength(1);
  });

  it("clearScenario removes only that scenario", () => {
    useRunHistoryStore.getState().pushResult("s1", makeEntry({}));
    useRunHistoryStore.getState().pushResult("s2", makeEntry({}));
    useRunHistoryStore.getState().clearScenario("s1");
    expect(useRunHistoryStore.getState().getResults("s1")).toHaveLength(0);
    expect(useRunHistoryStore.getState().getResults("s2")).toHaveLength(1);
  });
});
