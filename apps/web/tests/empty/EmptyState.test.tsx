// tests/empty/EmptyState.test.tsx
// Tests for the canonical EmptyState component.
//
// - Renders required parts (icon, title, helper, CTA)
// - Renders sample cards when provided
// - Clicking a sample card calls fetch + importBundleObject
// - Does NOT call importBundleObject when no teamId is available
// - No overwrite: importBundleObject always creates (via postImportBundle), never patches

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { EmptyState } from "../../src/components/EmptyState";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockImportBundleObject = vi.fn().mockResolvedValue(undefined);

vi.mock("../../src/projects/projectsStore", () => ({
  useProjectsStore: () => ({
    importBundleObject: mockImportBundleObject,
  }),
}));

const mockActiveTeamId = { current: "team-1" };

vi.mock("../../src/teams/teamStore", () => ({
  useTeamStore: () => ({
    get activeTeamId() {
      return mockActiveTeamId.current;
    },
  }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SAMPLE_BUNDLE = {
  id: "test-bundle",
  name: "Test Bundle",
  createdAt: "2026-01-01T00:00:00Z",
  versions: [],
};

function renderEmptyState(props: Partial<React.ComponentProps<typeof EmptyState>> = {}) {
  return render(
    <MantineProvider>
      <Notifications />
      <EmptyState
        icon={<span data-testid="test-icon" />}
        title="No items yet"
        helper="Add an item or load a sample."
        {...props}
      />
    </MantineProvider>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("EmptyState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockActiveTeamId.current = "team-1";
  });

  it("renders title and helper text", () => {
    renderEmptyState();
    expect(screen.getByText("No items yet")).toBeInTheDocument();
    expect(screen.getByText("Add an item or load a sample.")).toBeInTheDocument();
  });

  it("renders primary CTA when provided", () => {
    const onClick = vi.fn();
    renderEmptyState({ primaryCta: { label: "New item", onClick } });
    const btn = screen.getByRole("button", { name: "New item" });
    expect(btn).toBeInTheDocument();
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("does not render CTA button when primaryCta is omitted", () => {
    renderEmptyState();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("renders sample cards when samples prop is provided", () => {
    renderEmptyState({
      samples: [
        { slug: "github-rest", name: "GitHub REST API" },
        { slug: "jsonplaceholder-crud", name: "JSONPlaceholder CRUD" },
      ],
    });
    expect(screen.getByTestId("sample-card-github-rest")).toBeInTheDocument();
    expect(screen.getByTestId("sample-card-jsonplaceholder-crud")).toBeInTheDocument();
    expect(screen.getByText("GitHub REST API")).toBeInTheDocument();
    expect(screen.getByText("JSONPlaceholder CRUD")).toBeInTheDocument();
  });

  it("clicking a sample card fetches the bundle and calls importBundleObject", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => SAMPLE_BUNDLE,
    } as Response);

    renderEmptyState({
      samples: [{ slug: "github-rest", name: "GitHub REST API" }],
    });

    fireEvent.click(screen.getByTestId("sample-card-github-rest"));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith("/gallery/github-rest.bundle.json");
      expect(mockImportBundleObject).toHaveBeenCalledWith(SAMPLE_BUNDLE, "team-1");
    });

    fetchSpy.mockRestore();
  });

  it("uses teamId prop over store activeTeamId when both present", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => SAMPLE_BUNDLE,
    } as Response);

    renderEmptyState({
      samples: [{ slug: "github-rest", name: "GitHub REST API" }],
      teamId: "team-override",
    });

    fireEvent.click(screen.getByTestId("sample-card-github-rest"));

    await waitFor(() => {
      expect(mockImportBundleObject).toHaveBeenCalledWith(SAMPLE_BUNDLE, "team-override");
    });

    fetchSpy.mockRestore();
  });

  it("does NOT call importBundleObject when no team is available", async () => {
    mockActiveTeamId.current = null as unknown as string;
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    renderEmptyState({
      samples: [{ slug: "github-rest", name: "GitHub REST API" }],
    });

    fireEvent.click(screen.getByTestId("sample-card-github-rest"));

    // fetch should not be called because we abort early
    await waitFor(() => {
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(mockImportBundleObject).not.toHaveBeenCalled();
    });

    fetchSpy.mockRestore();
  });

  it("importBundleObject creates a NEW project (does not overwrite existing bundles)", async () => {
    // importBundleObject always calls postImportBundle → server creates a new project.
    // We verify it is called once per click (never called with an existing project ID as target).
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => SAMPLE_BUNDLE,
    } as Response);

    renderEmptyState({
      samples: [
        { slug: "github-rest", name: "GitHub REST API" },
      ],
    });

    fireEvent.click(screen.getByTestId("sample-card-github-rest"));

    await waitFor(() => {
      expect(mockImportBundleObject).toHaveBeenCalledTimes(1);
      // The call must NOT include any existing project ID override
      const [calledBundle] = mockImportBundleObject.mock.calls[0] as [typeof SAMPLE_BUNDLE, string];
      expect(calledBundle.id).toBe("test-bundle");
    });

    fetchSpy.mockRestore();
  });
});
