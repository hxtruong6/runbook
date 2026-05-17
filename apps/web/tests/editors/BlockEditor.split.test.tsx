import { describe, it, expect, beforeEach, afterEach } from "vitest";

const SPLIT_STORAGE_KEY = "rb_block_editor_split";
const DEFAULT_SPLIT = 50;

// Helper: replicate the loadSplitSize / saveSplitSize logic from BlockCard
function loadSplitSize(blockKind: string): number {
  try {
    const raw = localStorage.getItem(SPLIT_STORAGE_KEY);
    if (!raw) return DEFAULT_SPLIT;
    const stored = JSON.parse(raw) as Record<string, number>;
    return stored[blockKind] ?? DEFAULT_SPLIT;
  } catch {
    return DEFAULT_SPLIT;
  }
}

function saveSplitSize(blockKind: string, size: number) {
  try {
    const raw = localStorage.getItem(SPLIT_STORAGE_KEY);
    const stored = raw ? (JSON.parse(raw) as Record<string, number>) : {};
    stored[blockKind] = size;
    localStorage.setItem(SPLIT_STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // ignore
  }
}

describe("BlockEditor split pane — localStorage persistence", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("returns default 50 when no value is stored", () => {
    expect(loadSplitSize("httpRequest")).toBe(50);
  });

  it("saves and reloads a custom split size", () => {
    saveSplitSize("httpRequest", 65);
    expect(loadSplitSize("httpRequest")).toBe(65);
  });

  it("persists per block kind independently", () => {
    saveSplitSize("httpRequest", 40);
    saveSplitSize("signin", 70);
    expect(loadSplitSize("httpRequest")).toBe(40);
    expect(loadSplitSize("signin")).toBe(70);
  });

  it("persists after simulated remount (re-reading from localStorage)", () => {
    // Simulate initial mount + drag → save
    saveSplitSize("urlTemplate", 35);

    // Simulate unmount + remount → load
    const sizeAfterRemount = loadSplitSize("urlTemplate");
    expect(sizeAfterRemount).toBe(35);
  });

  it("falls back to default for unknown kind after data exists for others", () => {
    saveSplitSize("httpRequest", 60);
    expect(loadSplitSize("unknownKind")).toBe(DEFAULT_SPLIT);
  });
});
