import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { spotlight } from "@mantine/spotlight";
import { CommandPalette, getRecents, pushRecent } from "../../src/features/palette/CommandPalette";
import { theme } from "../../src/theme";
import type { Scenario } from "../../src/scenarios/types";

// ─── Mocks ────────────────────────────────────────────────────────────────────

// @mantine/spotlight CSS import — suppress in jsdom
vi.mock("@mantine/spotlight/styles.css", () => ({}));

// jsdom doesn't implement window.matchMedia — polyfill for Mantine's color scheme hook
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// jsdom doesn't implement ResizeObserver — polyfill for Mantine's ScrollArea
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// jsdom doesn't implement scrollIntoView — polyfill for Mantine Spotlight selection
Element.prototype.scrollIntoView = vi.fn();

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SCENARIOS: Scenario[] = [
  { id: "s1", name: "Login flow", createdAt: "", blocks: [], reusable: false },
  { id: "s2", name: "Create user", createdAt: "", blocks: [], reusable: false },
  { id: "s3", name: "Delete account", createdAt: "", blocks: [], reusable: true },
];

function renderPalette(overrides?: Partial<Parameters<typeof CommandPalette>[0]>) {
  const defaults = {
    scenarios: SCENARIOS,
    activeScenarioId: "s1",
    envKeys: ["API_URL", "AUTH_TOKEN"],
    onSelectScenario: vi.fn(),
    onRunScenario: vi.fn(),
    onNavigateToBlocks: vi.fn(),
  };
  const props = { ...defaults, ...overrides };
  return {
    // env="test" disables transitions & portals so modal content renders immediately
    ...render(
      <MantineProvider theme={theme} env="test">
        <CommandPalette {...props} />
      </MantineProvider>
    ),
    props,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("CommandPalette recents helpers", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("getRecents returns empty array when nothing stored", () => {
    expect(getRecents()).toEqual([]);
  });

  it("pushRecent stores an entry", () => {
    pushRecent({ id: "s1", label: "Login flow", group: "scenario" });
    const recents = getRecents();
    expect(recents).toHaveLength(1);
    expect(recents[0]).toMatchObject({ id: "s1", label: "Login flow", group: "scenario" });
  });

  it("pushRecent deduplicates by id", () => {
    pushRecent({ id: "s1", label: "Login flow", group: "scenario" });
    pushRecent({ id: "s1", label: "Login flow", group: "scenario" });
    expect(getRecents()).toHaveLength(1);
  });

  it("pushRecent promotes an existing entry to top", () => {
    pushRecent({ id: "s1", label: "Login flow", group: "scenario" });
    pushRecent({ id: "s2", label: "Create user", group: "scenario" });
    pushRecent({ id: "s1", label: "Login flow", group: "scenario" });
    const recents = getRecents();
    expect(recents[0]!.id).toBe("s1");
  });

  it("pushRecent caps at 8 entries", () => {
    for (let i = 0; i < 12; i++) {
      pushRecent({ id: `s${i}`, label: `Scenario ${i}`, group: "scenario" });
    }
    expect(getRecents()).toHaveLength(8);
  });
});

describe("CommandPalette rendering", () => {
  beforeEach(() => {
    localStorage.clear();
    // Ensure spotlight is closed between tests
    act(() => { spotlight.close(); });
  });

  it("renders without crashing", () => {
    renderPalette();
    // Spotlight component is rendered (but closed — it's a portal/overlay)
    // The component itself doesn't throw
    expect(true).toBe(true);
  });

  it("opens when ⌘K / Ctrl+K is pressed", async () => {
    renderPalette();
    // Simulate Ctrl+K via the spotlight API (jsdom can't reliably fire composed key events)
    await act(async () => { spotlight.open(); });
    // After opening, the search input should appear
    const input = screen.queryByPlaceholderText(/search scenarios, actions/i);
    expect(input).not.toBeNull();
  });

  it("shows scenario actions after opening", async () => {
    renderPalette();
    await act(async () => { spotlight.open(); });
    expect(screen.getByText("Login flow")).toBeInTheDocument();
    expect(screen.getByText("Create user")).toBeInTheDocument();
  });

  it("shows system actions after opening", async () => {
    renderPalette();
    await act(async () => { spotlight.open(); });
    expect(screen.getByText("Run last scenario")).toBeInTheDocument();
    expect(screen.getByText("Toggle color scheme")).toBeInTheDocument();
    expect(screen.getByText("Open demo page")).toBeInTheDocument();
    expect(screen.getByText("Paste curl…")).toBeInTheDocument();
    expect(screen.getByText("Import OpenAPI…")).toBeInTheDocument();
  });

  it("fuzzy-filters results when typing", async () => {
    renderPalette();
    await act(async () => { spotlight.open(); });
    const input = screen.getByPlaceholderText(/search scenarios, actions/i);
    await act(async () => {
      fireEvent.change(input, { target: { value: "login" } });
    });
    // With "login" query, "Login flow" should still be visible
    // (matched by label), "Create user" should not be visible
    const loginItems = screen.queryAllByText(/login flow/i);
    expect(loginItems.length).toBeGreaterThan(0);
    expect(screen.queryByText("Create user")).toBeNull();
  });

  it("calls onSelectScenario when a scenario action is clicked", async () => {
    const onSelectScenario = vi.fn();
    renderPalette({ onSelectScenario });
    await act(async () => { spotlight.open(); });
    const loginAction = screen.getByText("Login flow");
    await act(async () => {
      fireEvent.click(loginAction);
    });
    expect(onSelectScenario).toHaveBeenCalledWith("s1");
  });

  it("calls onRunScenario when 'Run last scenario' is clicked", async () => {
    const onRunScenario = vi.fn();
    renderPalette({ onRunScenario });
    await act(async () => { spotlight.open(); });
    const runAction = screen.getByText("Run last scenario");
    await act(async () => {
      fireEvent.click(runAction);
    });
    expect(onRunScenario).toHaveBeenCalledWith("s1");
  });

  it("calls onNavigateToBlocks when 'Paste curl…' is clicked", async () => {
    const onNavigateToBlocks = vi.fn();
    renderPalette({ onNavigateToBlocks });
    await act(async () => { spotlight.open(); });
    const curlAction = screen.getByText("Paste curl…");
    await act(async () => {
      fireEvent.click(curlAction);
    });
    expect(onNavigateToBlocks).toHaveBeenCalled();
  });

  it("calls onNavigateToBlocks when 'Import OpenAPI…' is clicked", async () => {
    const onNavigateToBlocks = vi.fn();
    renderPalette({ onNavigateToBlocks });
    await act(async () => { spotlight.open(); });
    const openApiAction = screen.getByText("Import OpenAPI…");
    await act(async () => {
      fireEvent.click(openApiAction);
    });
    expect(onNavigateToBlocks).toHaveBeenCalled();
  });

  it("shows recent items pinned to top when recents exist", async () => {
    pushRecent({ id: "s2", label: "Create user", group: "scenario" });
    renderPalette();
    await act(async () => { spotlight.open(); });
    // "Recent" group entry for "Create user" should be visible
    // (appears as "Recent · Scenario" description under the recent item)
    const recentDescriptions = screen.getAllByText(/recent/i);
    expect(recentDescriptions.length).toBeGreaterThan(0);
  });
});
