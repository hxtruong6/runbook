// tests/onboarding/Tour.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useTour, TOUR_STEPS } from "../../src/features/onboarding/Tour";
import type { ProjectBundle } from "../../src/projects/types";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock the storage module so we can control hasSavedProjects()
vi.mock("../../src/projects/storage", () => ({
  loadState: vi.fn(),
}));

import { loadState } from "../../src/projects/storage";

// Mock fetch for the tour bundle
const mockBundle: ProjectBundle = {
  id: "tour-bundle",
  name: "Tour Bundle",
  createdAt: "2026-01-01T00:00:00Z",
  versions: [
    {
      version: "1.0.0",
      releasedAt: "2026-01-01T00:00:00Z",
      releaseNotes: "",
      changes: [],
      blocks: [],
      scenarios: [
        {
          id: "tour-scenario-1",
          name: "Demo",
          createdAt: "2026-01-01T00:00:00Z",
          blocks: [],
          reusable: false,
        },
      ],
      environments: [
        {
          id: "tour-env-1",
          name: "JSONPlaceholder (no auth)",
          baseUrl: "https://jsonplaceholder.typicode.com",
          auth: { kind: "none" },
          headers: {},
          createdAt: "2026-01-01T00:00:00Z",
        },
      ],
      docs: {},
    },
  ],
};

// ---------------------------------------------------------------------------
// localStorage helpers
// ---------------------------------------------------------------------------

function clearTourKeys() {
  localStorage.removeItem("rb_tour_banner_dismissed");
  localStorage.removeItem("rb_tour_completed");
  localStorage.removeItem("rb_tour_loaded");
  localStorage.removeItem("rb_no_telemetry");
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  clearTourKeys();

  // Default: no saved projects (first visit)
  vi.mocked(loadState).mockReturnValue({
    bundles: [],
    activeProjectId: null,
    activeVersionByProject: {},
  });

  // Default fetch returns a valid tour bundle
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => mockBundle,
  } as Response);
});

afterEach(() => {
  vi.restoreAllMocks();
  clearTourKeys();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useTour — first visit auto-load", () => {
  it("fetches the tour bundle and activates the tour on first visit", async () => {
    const onBundleLoaded = vi.fn();
    const { result } = renderHook(() => useTour(onBundleLoaded));

    // Initially not active (loading)
    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(onBundleLoaded).toHaveBeenCalledWith(
      expect.objectContaining({ id: "tour-bundle" })
    );
    expect(result.current.active).toBe(true);
    expect(result.current.step).toBe(0);
  });

  it("shows banner on first visit", async () => {
    const { result } = renderHook(() => useTour());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.bannerVisible).toBe(true);
  });

  it("starts at step 0", async () => {
    const { result } = renderHook(() => useTour());
    await waitFor(() => expect(result.current.active).toBe(true));
    expect(result.current.step).toBe(0);
  });

  it("marks tour as loaded in localStorage after fetch", async () => {
    const { result } = renderHook(() => useTour());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(localStorage.getItem("rb_tour_loaded")).toBe("1");
  });
});

describe("useTour — returning user (has projects)", () => {
  beforeEach(() => {
    vi.mocked(loadState).mockReturnValue({
      bundles: [
        {
          id: "existing-project",
          name: "My Project",
          createdAt: "2026-01-01T00:00:00Z",
          versions: [],
        },
      ],
      activeProjectId: "existing-project",
      activeVersionByProject: {},
    });
  });

  it("does NOT activate the tour for returning users", async () => {
    const onBundleLoaded = vi.fn();
    const { result } = renderHook(() => useTour(onBundleLoaded));

    // Give async effects a chance to fire
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(result.current.active).toBe(false);
    expect(onBundleLoaded).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("hides banner for returning users", () => {
    const { result } = renderHook(() => useTour());
    expect(result.current.bannerVisible).toBe(false);
  });
});

describe("useTour — banner dismissal persists", () => {
  it("dismissing banner sets localStorage flag", async () => {
    const { result } = renderHook(() => useTour());
    await waitFor(() => expect(result.current.bannerVisible).toBe(true));

    act(() => {
      result.current.dismissBannerFn();
    });

    expect(result.current.bannerVisible).toBe(false);
    expect(localStorage.getItem("rb_tour_banner_dismissed")).toBe("1");
  });

  it("banner stays hidden after re-mount when flag is set", async () => {
    localStorage.setItem("rb_tour_banner_dismissed", "1");
    const { result } = renderHook(() => useTour());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.bannerVisible).toBe(false);
  });
});

describe("useTour — step navigation", () => {
  it("advances through steps with next()", async () => {
    const { result } = renderHook(() => useTour());
    await waitFor(() => expect(result.current.active).toBe(true));

    act(() => result.current.next());
    expect(result.current.step).toBe(1);

    act(() => result.current.next());
    expect(result.current.step).toBe(2);
  });

  it("goes back with prev()", async () => {
    const { result } = renderHook(() => useTour());
    await waitFor(() => expect(result.current.active).toBe(true));

    act(() => result.current.next());
    act(() => result.current.prev());
    expect(result.current.step).toBe(0);
  });

  it("prev() does not go below 0", async () => {
    const { result } = renderHook(() => useTour());
    await waitFor(() => expect(result.current.active).toBe(true));

    act(() => result.current.prev());
    expect(result.current.step).toBe(0);
  });

  it("completing last step deactivates tour and marks completed", async () => {
    const { result } = renderHook(() => useTour());
    await waitFor(() => expect(result.current.active).toBe(true));

    // Step through all steps
    for (let i = 0; i < TOUR_STEPS.length; i++) {
      act(() => result.current.next());
    }

    expect(result.current.active).toBe(false);
    expect(localStorage.getItem("rb_tour_completed")).toBe("1");
  });

  it("dismiss() deactivates tour immediately and marks completed", async () => {
    const { result } = renderHook(() => useTour());
    await waitFor(() => expect(result.current.active).toBe(true));

    act(() => result.current.dismiss());

    expect(result.current.active).toBe(false);
    expect(localStorage.getItem("rb_tour_completed")).toBe("1");
  });
});

describe("useTour — fetch error handling", () => {
  it("sets error state when bundle fetch fails", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    } as Response);

    const { result } = renderHook(() => useTour());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBeTruthy();
    expect(result.current.active).toBe(false);
  });

  it("sets error when fetch rejects (network failure)", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));
    const { result } = renderHook(() => useTour());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeTruthy();
  });
});

describe("useTour — telemetry opt-out", () => {
  it("does not emit events when rb_no_telemetry is set", async () => {
    localStorage.setItem("rb_no_telemetry", "1");
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { result } = renderHook(() => useTour());
    await waitFor(() => expect(result.current.active).toBe(true));

    // Complete tour
    for (let i = 0; i < TOUR_STEPS.length; i++) {
      act(() => result.current.next());
    }

    expect(consoleSpy).not.toHaveBeenCalledWith(
      "[runbook:telemetry]",
      expect.objectContaining({ event: "first_run_completed" })
    );
    consoleSpy.mockRestore();

  });
});

describe("TOUR_STEPS structure", () => {
  it("has exactly 3 steps", () => {
    expect(TOUR_STEPS).toHaveLength(3);
  });

  it("step 1 targets the env picker anchor", () => {
    expect(TOUR_STEPS[0]!.anchorId).toBe("tour-anchor-env");
  });

  it("step 2 targets the run button anchor", () => {
    expect(TOUR_STEPS[1]!.anchorId).toBe("tour-anchor-run");
  });

  it("step 3 targets the result / edit anchor", () => {
    expect(TOUR_STEPS[2]!.anchorId).toBe("tour-anchor-result");
  });
});
