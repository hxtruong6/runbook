// tests/versions/changeList.test.ts
// Tests for the buildChecklist utility and ChangeList grouping logic.
import { describe, it, expect } from "vitest";
import { buildChecklist } from "../../src/features/versions/ChangeList";
import type { ChangeEntry } from "../../src/projects/types";

const FIXTURE_CHANGES: ChangeEntry[] = [
  { type: "added", target: "signin", summary: "POST /v1/user/auth/signin" },
  { type: "modified", target: "profile", summary: "Changed response shape" },
  { type: "removed", target: "legacyEndpoint", summary: "Endpoint removed", breaking: true, removeBy: "3.0.0" },
  { type: "fixed", summary: "Fixed null pointer in token refresh" },
  { type: "deprecated", target: "oldAuth", summary: "Use bearer tokens instead" },
  { type: "note", summary: "See migration guide for details" },
];

describe("buildChecklist", () => {
  it("includes the version label heading", () => {
    const md = buildChecklist(FIXTURE_CHANGES, "2.1.0");
    expect(md).toContain("## Upgrade checklist — 2.1.0");
  });

  it("produces a checkbox for each change", () => {
    const md = buildChecklist(FIXTURE_CHANGES, "2.1.0");
    // Every change should produce a checkbox line
    const checkboxes = md.split("\n").filter((l) => l.trim().startsWith("- [ ]"));
    expect(checkboxes).toHaveLength(FIXTURE_CHANGES.length);
  });

  it("marks breaking changes with **BREAKING**", () => {
    const md = buildChecklist(FIXTURE_CHANGES, "2.1.0");
    expect(md).toContain("**BREAKING**");
    expect(md).toContain("`legacyEndpoint`");
  });

  it("includes removeBy annotation as a nested list item", () => {
    const md = buildChecklist(FIXTURE_CHANGES, "2.1.0");
    expect(md).toContain("Will be removed in 3.0.0");
  });

  it("groups by category with section headings", () => {
    const md = buildChecklist(FIXTURE_CHANGES, "2.1.0");
    expect(md).toContain("### Added");
    expect(md).toContain("### Changed");
    expect(md).toContain("### Removed");
    expect(md).toContain("### Fixed");
    expect(md).toContain("### Deprecated");
    expect(md).toContain("### Notes");
  });

  it("does not include empty category sections", () => {
    const onlyAdded: ChangeEntry[] = [
      { type: "added", target: "foo", summary: "bar" },
    ];
    const md = buildChecklist(onlyAdded, "1.0.0");
    expect(md).toContain("### Added");
    expect(md).not.toContain("### Changed");
    expect(md).not.toContain("### Removed");
  });

  it("returns empty checklist for no changes", () => {
    const md = buildChecklist([], "1.0.0");
    expect(md).toContain("## Upgrade checklist — 1.0.0");
    // No checkboxes
    const checkboxes = md.split("\n").filter((l) => l.trim().startsWith("- [ ]"));
    expect(checkboxes).toHaveLength(0);
  });

  it("includes target in backtick code span when present", () => {
    const md = buildChecklist(FIXTURE_CHANGES, "2.1.0");
    expect(md).toContain("`signin`");
    expect(md).toContain("`profile`");
  });

  it("omits backtick span when target is absent", () => {
    const changes: ChangeEntry[] = [
      { type: "note", summary: "No target here" },
    ];
    const md = buildChecklist(changes, "1.0.0");
    // Should not have a backtick-enclosed empty string
    expect(md).not.toContain("``");
  });
});
