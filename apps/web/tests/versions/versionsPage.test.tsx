// tests/versions/versionsPage.test.tsx
// Integration-level render tests for VersionsPage and ChangeList.
import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import { theme } from "../../src/theme";
import { VersionsPage } from "../../src/pages/VersionsPage";
import { ChangeList } from "../../src/features/versions/ChangeList";
import type { ChangeEntry } from "../../src/projects/types";
import type { ApiProject } from "../../src/api/projects";

// ---------------------------------------------------------------------------
// Fixture data — 3-version bundle
// ---------------------------------------------------------------------------

const VERSION_1: ApiProject["versions"] extends undefined ? never : NonNullable<ApiProject["versions"]>[number] = {
  version: "1.0.0",
  releasedAt: "2026-01-01T00:00:00Z",
  releaseNotes: "Initial release",
  changes: [
    { type: "added", target: "signin", summary: "POST /v1/user/auth/signin" },
    { type: "added", target: "profile", summary: "GET /v1/user/auth/profile" },
  ],
  blocks: [],
  environments: [],
  docs: {},
};

const VERSION_2: typeof VERSION_1 = {
  version: "1.1.0",
  releasedAt: "2026-02-01T00:00:00Z",
  releaseNotes: "Minor improvements",
  changes: [
    { type: "modified", target: "profile", summary: "Added chairside token field" },
    { type: "fixed", summary: "Fixed null pointer in token refresh" },
  ],
  blocks: [],
  environments: [],
  docs: {},
};

const VERSION_3: typeof VERSION_1 = {
  version: "2.0.0",
  releasedAt: "2026-03-01T00:00:00Z",
  releaseNotes: "Breaking changes",
  changes: [
    { type: "removed", target: "legacyAuth", summary: "Removed legacy auth endpoint", breaking: true },
    { type: "added", target: "chairside", summary: "POST /v1/aligner/user/ortho-reviews/chairside" },
    { type: "deprecated", target: "oldFlow", summary: "Use new chairside flow instead" },
  ],
  blocks: [],
  environments: [],
  docs: {},
};

const THREE_VERSION_PROJECT: ApiProject = {
  _id: "proj-123",
  teamId: "team-1",
  name: "Test Project",
  createdAt: "2026-01-01T00:00:00Z",
  versions: [VERSION_1, VERSION_2, VERSION_3],
};

const SINGLE_VERSION_PROJECT: ApiProject = {
  _id: "proj-single",
  teamId: "team-1",
  name: "Single Version Project",
  createdAt: "2026-01-01T00:00:00Z",
  versions: [VERSION_1],
};

// ---------------------------------------------------------------------------
// Mock projectsStore
// ---------------------------------------------------------------------------

vi.mock("../../src/projects/projectsStore", () => ({
  useProjectsStore: vi.fn(),
}));

import { useProjectsStore } from "../../src/projects/projectsStore";

const mockUseProjectsStore = vi.mocked(useProjectsStore);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <MantineProvider theme={theme}>
      <Notifications />
      {ui}
    </MantineProvider>,
  );
}

// ---------------------------------------------------------------------------
// Tests: VersionsPage with 3-version bundle
// ---------------------------------------------------------------------------

describe("VersionsPage — three version bundle", () => {
  beforeEach(() => {
    mockUseProjectsStore.mockReturnValue({
      projects: [THREE_VERSION_PROJECT],
      activeProjectId: "proj-123",
      loading: false,
    } as ReturnType<typeof useProjectsStore>);
  });

  it("renders all three versions in the left panel (latest first)", () => {
    renderWithProviders(<VersionsPage opened onClose={vi.fn()} />);
    const navLinks = screen.getAllByText(/^\d+\.\d+\.\d+$/);
    const versionTexts = navLinks.map((el) => el.textContent);
    // Sorted newest → oldest
    expect(versionTexts[0]).toBe("2.0.0");
    expect(versionTexts[1]).toBe("1.1.0");
    expect(versionTexts[2]).toBe("1.0.0");
  });

  it("shows 'latest' badge on the newest version", () => {
    renderWithProviders(<VersionsPage opened onClose={vi.fn()} />);
    expect(screen.getByText("latest")).toBeInTheDocument();
  });

  it("shows the changes of the newest version by default (right panel)", () => {
    renderWithProviders(<VersionsPage opened onClose={vi.fn()} />);
    // 2.0.0 changes should be visible
    expect(screen.getByText("legacyAuth")).toBeInTheDocument();
    expect(screen.getByText("chairside")).toBeInTheDocument();
  });

  it("switches diff panel when a different version is clicked", () => {
    renderWithProviders(<VersionsPage opened onClose={vi.fn()} />);
    // Click on 1.1.0
    fireEvent.click(screen.getByText("1.1.0"));
    expect(screen.getByText("profile")).toBeInTheDocument();
  });

  it("shows the Copy upgrade checklist button", () => {
    renderWithProviders(<VersionsPage opened onClose={vi.fn()} />);
    expect(screen.getByText("Copy upgrade checklist")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Tests: VersionsPage with single-version bundle (empty state)
// ---------------------------------------------------------------------------

describe("VersionsPage — single-version bundle (empty state)", () => {
  beforeEach(() => {
    mockUseProjectsStore.mockReturnValue({
      projects: [SINGLE_VERSION_PROJECT],
      activeProjectId: "proj-single",
      loading: false,
    } as ReturnType<typeof useProjectsStore>);
  });

  it("shows the empty state message", () => {
    renderWithProviders(<VersionsPage opened onClose={vi.fn()} />);
    expect(
      screen.getByText("No version history yet"),
    ).toBeInTheDocument();
  });

  it("shows the 'single version' helper text", () => {
    renderWithProviders(<VersionsPage opened onClose={vi.fn()} />);
    expect(
      screen.getByText(/This bundle only has a single version/),
    ).toBeInTheDocument();
  });

  it("does NOT show the version list", () => {
    renderWithProviders(<VersionsPage opened onClose={vi.fn()} />);
    expect(screen.queryByText("Versions (")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Tests: Copy upgrade checklist produces expected markdown
// ---------------------------------------------------------------------------

describe("ChangeList — copy checklist markdown", () => {
  it("renders the Copy upgrade checklist button", () => {
    const changes: ChangeEntry[] = [
      { type: "added", target: "foo", summary: "New foo endpoint" },
      { type: "removed", target: "bar", summary: "Deprecated bar", breaking: true },
    ];
    renderWithProviders(<ChangeList versionLabel="2.0.0" changes={changes} />);
    expect(screen.getByText("Copy upgrade checklist")).toBeInTheDocument();
  });

  it("renders all change categories", () => {
    const changes: ChangeEntry[] = [
      { type: "added", target: "a", summary: "Added a" },
      { type: "modified", target: "b", summary: "Changed b" },
      { type: "fixed", summary: "Fixed bug" },
      { type: "deprecated", target: "c", summary: "Deprecated c" },
      { type: "removed", target: "d", summary: "Removed d" },
    ];
    renderWithProviders(<ChangeList versionLabel="1.0.0" changes={changes} />);
    expect(screen.getByText("Added")).toBeInTheDocument();
    expect(screen.getByText("Changed")).toBeInTheDocument();
    expect(screen.getByText("Fixed")).toBeInTheDocument();
    expect(screen.getByText("Deprecated")).toBeInTheDocument();
    expect(screen.getByText("Removed")).toBeInTheDocument();
  });

  it("shows BREAKING badge on breaking changes", () => {
    const changes: ChangeEntry[] = [
      { type: "removed", target: "x", summary: "Removed x", breaking: true },
    ];
    renderWithProviders(<ChangeList versionLabel="2.0.0" changes={changes} />);
    expect(screen.getByText("BREAKING")).toBeInTheDocument();
  });

  it("shows empty-changes message when changes is empty", () => {
    renderWithProviders(<ChangeList versionLabel="1.0.0" changes={[]} />);
    expect(
      screen.getByText("No recorded changes for this version."),
    ).toBeInTheDocument();
  });
});
