/**
 * Responsive tests for UX-D9: mobile-readable run results.
 *
 * Strategy:
 * - Mock `window.matchMedia` to simulate a 360px mobile viewport.
 * - Render <SharedRun> and assert that:
 *   1. The Accordion is present (side panels collapsed on mobile).
 *   2. The desktop side-panels element is NOT present.
 *   3. The "Fork" button has `size="md"` which resolves to minHeight ≥ 44px
 *      (verified via the data-testid + Mantine's size prop on the element).
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { SharedRun, type SharedRunData } from "../../src/pages/SharedRun";
import type { BlockRunResult } from "../../src/blocks/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockMediaQuery(matches: boolean) {
  const mq: MediaQueryList = {
    matches,
    media: "",
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  };
  return vi.spyOn(window, "matchMedia").mockReturnValue(mq);
}

function renderWithMantine(ui: React.ReactElement) {
  return render(<MantineProvider>{ui}</MantineProvider>);
}

// ---------------------------------------------------------------------------
// Fixture data
// ---------------------------------------------------------------------------

const okResult: BlockRunResult = {
  status: "ok",
  elapsedMs: 120,
  response: { id: 1, name: "Alice" },
  captured: { userId: 1 },
  httpStatus: 200,
  request: {
    method: "GET",
    url: "https://api.example.com/users/1",
    headers: {},
  },
};

const sharedRunData: SharedRunData = {
  scenarioName: "Fetch user profile",
  runAt: new Date("2026-05-17T10:00:00Z").toISOString(),
  blockResults: [
    {
      label: "GET User",
      kind: "urlTemplate",
      result: okResult,
    },
  ],
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("SharedRun — mobile layout (max-width: 768px)", () => {
  let spy: ReturnType<typeof vi.spyOn>;

  beforeAll(() => {
    // Simulate a 360px viewport — matchMedia returns true for max-width:768px
    spy = mockMediaQuery(true);
  });

  afterAll(() => {
    spy.mockRestore();
  });

  it("renders the Accordion for side panels on mobile", () => {
    renderWithMantine(
      <SharedRun data={sharedRunData} onFork={() => {}} />
    );

    // The accordion wrapper should be present
    expect(
      screen.getByTestId("side-panels-accordion")
    ).toBeInTheDocument();
  });

  it("does NOT render the desktop side-panels element on mobile", () => {
    renderWithMantine(
      <SharedRun data={sharedRunData} onFork={() => {}} />
    );

    expect(
      screen.queryByTestId("desktop-side-panels")
    ).not.toBeInTheDocument();
  });

  it("renders the mobile layout container on mobile", () => {
    renderWithMantine(
      <SharedRun data={sharedRunData} onFork={() => {}} />
    );

    expect(screen.getByTestId("mobile-layout")).toBeInTheDocument();
  });

  it("Fork button has the md size prop (≥ 44px tap target)", () => {
    renderWithMantine(
      <SharedRun data={sharedRunData} onFork={() => {}} />
    );

    const forkBtn = screen.getByTestId("fork-button");
    expect(forkBtn).toBeInTheDocument();

    // Mantine's size="md" sets min-height via CSS vars; we verify via inline style
    // that we explicitly set minHeight: 44 on the button element.
    const style = forkBtn.getAttribute("style") ?? "";
    expect(style).toContain("min-height: 44px");
  });

  it("Share button has the md size prop (≥ 44px tap target)", () => {
    renderWithMantine(
      <SharedRun data={sharedRunData} onFork={() => {}} />
    );

    const shareBtn = screen.getByTestId("share-button");
    expect(shareBtn).toBeInTheDocument();
    const style = shareBtn.getAttribute("style") ?? "";
    expect(style).toContain("min-height: 44px");
  });
});

describe("SharedRun — desktop layout (≥ 768px)", () => {
  let spy: ReturnType<typeof vi.spyOn>;

  beforeAll(() => {
    // Simulate a desktop viewport — matchMedia returns false for max-width:768px
    spy = mockMediaQuery(false);
  });

  afterAll(() => {
    spy.mockRestore();
  });

  it("renders desktop side-panels on desktop", () => {
    renderWithMantine(
      <SharedRun data={sharedRunData} onFork={() => {}} />
    );

    expect(screen.getByTestId("desktop-side-panels")).toBeInTheDocument();
  });

  it("does NOT render Accordion on desktop", () => {
    renderWithMantine(
      <SharedRun data={sharedRunData} onFork={() => {}} />
    );

    expect(
      screen.queryByTestId("side-panels-accordion")
    ).not.toBeInTheDocument();
  });
});

describe("SharedRun — JSON viewer", () => {
  it("renders json-viewer block", () => {
    mockMediaQuery(true);
    renderWithMantine(<SharedRun data={sharedRunData} />);

    const viewers = screen.getAllByTestId("json-viewer");
    expect(viewers.length).toBeGreaterThan(0);
  });
});
