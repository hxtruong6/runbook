// tests/gallery/index.test.ts
import { describe, it, expect } from "vitest";
import indexJson from "../../public/gallery/index.json";
import type { GalleryEntry } from "../../src/pages/useGallery";

describe("gallery/index.json", () => {
  it("loads as a valid JSON array", () => {
    expect(Array.isArray(indexJson)).toBe(true);
  });

  it("contains exactly 8 entries", () => {
    expect(indexJson).toHaveLength(8);
  });

  it("every entry has required fields", () => {
    const required: (keyof GalleryEntry)[] = [
      "slug",
      "name",
      "description",
      "version",
      "scenarioCount",
      "blockCount",
      "tags",
      "ogImage",
    ];
    for (const entry of indexJson as GalleryEntry[]) {
      for (const field of required) {
        expect(entry, `entry "${entry.slug}" missing field "${field}"`).toHaveProperty(field);
      }
    }
  });

  it("all slugs are unique", () => {
    const slugs = (indexJson as GalleryEntry[]).map((e) => e.slug);
    const unique = new Set(slugs);
    expect(unique.size).toBe(slugs.length);
  });

  it("all slugs are kebab-case strings", () => {
    for (const entry of indexJson as GalleryEntry[]) {
      expect(entry.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it("blockCount and scenarioCount are positive integers", () => {
    for (const entry of indexJson as GalleryEntry[]) {
      expect(entry.blockCount).toBeGreaterThan(0);
      expect(entry.scenarioCount).toBeGreaterThanOrEqual(1);
      expect(Number.isInteger(entry.blockCount)).toBe(true);
      expect(Number.isInteger(entry.scenarioCount)).toBe(true);
    }
  });

  it("tags are non-empty arrays of strings", () => {
    for (const entry of indexJson as GalleryEntry[]) {
      expect(Array.isArray(entry.tags)).toBe(true);
      expect(entry.tags.length).toBeGreaterThan(0);
      for (const tag of entry.tags) {
        expect(typeof tag).toBe("string");
      }
    }
  });

  it("version strings look like semver", () => {
    for (const entry of indexJson as GalleryEntry[]) {
      expect(entry.version).toMatch(/^\d+\.\d+(\.\d+)?$/);
    }
  });

  it("includes expected provider slugs", () => {
    const slugs = (indexJson as GalleryEntry[]).map((e) => e.slug);
    for (const expected of [
      "github",
      "openai",
      "anthropic",
      "stripe",
      "slack",
      "linear",
      "notion",
      "vercel",
    ]) {
      expect(slugs, `missing slug "${expected}"`).toContain(expected);
    }
  });
});
