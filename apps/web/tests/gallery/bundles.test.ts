// tests/gallery/bundles.test.ts
import { describe, it, expect } from "vitest";
import { ProjectBundleSchema } from "../../src/projects/types";

// Import all bundles statically so Vitest can resolve them without fetch
import githubBundle from "../../public/gallery/github.bundle.json";
import openaiBundle from "../../public/gallery/openai.bundle.json";
import anthropicBundle from "../../public/gallery/anthropic.bundle.json";
import stripeBundle from "../../public/gallery/stripe.bundle.json";
import slackBundle from "../../public/gallery/slack.bundle.json";
import linearBundle from "../../public/gallery/linear.bundle.json";
import notionBundle from "../../public/gallery/notion.bundle.json";
import vercelBundle from "../../public/gallery/vercel.bundle.json";
import indexJson from "../../public/gallery/index.json";

const bundles = [
  { slug: "github", bundle: githubBundle },
  { slug: "openai", bundle: openaiBundle },
  { slug: "anthropic", bundle: anthropicBundle },
  { slug: "stripe", bundle: stripeBundle },
  { slug: "slack", bundle: slackBundle },
  { slug: "linear", bundle: linearBundle },
  { slug: "notion", bundle: notionBundle },
  { slug: "vercel", bundle: vercelBundle },
];

describe("gallery bundles — schema validation", () => {
  for (const { slug, bundle } of bundles) {
    it(`${slug}.bundle.json parses via ProjectBundleSchema`, () => {
      const result = ProjectBundleSchema.safeParse(bundle);
      expect(
        result.success,
        `${slug} schema errors: ${JSON.stringify((result as { error?: unknown }).error)}`
      ).toBe(true);
    });
  }
});

describe("gallery bundles — content invariants", () => {
  for (const { slug, bundle } of bundles) {
    it(`${slug} has at least 3 blocks in the latest version`, () => {
      const latest = [...bundle.versions].sort((a, b) =>
        b.version.localeCompare(a.version, undefined, { numeric: true })
      )[0];
      expect(latest.blocks.length).toBeGreaterThanOrEqual(3);
    });

    it(`${slug} has at least 1 scenario in the latest version`, () => {
      const latest = [...bundle.versions].sort((a, b) =>
        b.version.localeCompare(a.version, undefined, { numeric: true })
      )[0];
      expect(latest.scenarios.length).toBeGreaterThanOrEqual(1);
    });

    it(`${slug} has at least 1 environment in the latest version`, () => {
      const latest = [...bundle.versions].sort((a, b) =>
        b.version.localeCompare(a.version, undefined, { numeric: true })
      )[0];
      expect(latest.environments.length).toBeGreaterThanOrEqual(1);
    });

    it(`${slug} all block kinds are unique within the version`, () => {
      const latest = [...bundle.versions].sort((a, b) =>
        b.version.localeCompare(a.version, undefined, { numeric: true })
      )[0];
      const kinds = latest.blocks.map((b) => b.kind);
      expect(new Set(kinds).size).toBe(kinds.length);
    });

    it(`${slug} every scenario block references a valid block kind`, () => {
      const latest = [...bundle.versions].sort((a, b) =>
        b.version.localeCompare(a.version, undefined, { numeric: true })
      )[0];
      const validKinds = new Set(latest.blocks.map((b) => b.kind));
      for (const scenario of latest.scenarios) {
        for (const bi of scenario.blocks) {
          expect(
            validKinds.has(bi.kind),
            `Scenario "${scenario.name}" references unknown kind "${bi.kind}" in ${slug}`
          ).toBe(true);
        }
      }
    });
  }
});

describe("gallery bundles — index.json consistency", () => {
  it("blockCount in index matches actual bundle block count", () => {
    for (const { slug, bundle } of bundles) {
      const entry = (indexJson as { slug: string; blockCount: number; scenarioCount: number }[]).find(
        (e) => e.slug === slug
      );
      expect(entry, `No index entry for ${slug}`).toBeDefined();
      const latest = [...bundle.versions].sort((a, b) =>
        b.version.localeCompare(a.version, undefined, { numeric: true })
      )[0];
      expect(entry!.blockCount).toBe(latest.blocks.length);
    }
  });

  it("scenarioCount in index matches actual bundle scenario count", () => {
    for (const { slug, bundle } of bundles) {
      const entry = (indexJson as { slug: string; blockCount: number; scenarioCount: number }[]).find(
        (e) => e.slug === slug
      );
      expect(entry, `No index entry for ${slug}`).toBeDefined();
      const latest = [...bundle.versions].sort((a, b) =>
        b.version.localeCompare(a.version, undefined, { numeric: true })
      )[0];
      expect(entry!.scenarioCount).toBe(latest.scenarios.length);
    }
  });
});

describe("gallery bundles — search filter simulation", () => {
  it("filter by 'ai' returns openai, anthropic", () => {
    const q = "ai";
    const results = bundles.filter(({ slug, bundle }) => {
      const entry = (indexJson as { slug: string; name: string; description: string; tags: string[] }[]).find(
        (e) => e.slug === slug
      );
      if (!entry) return false;
      return (
        entry.name.toLowerCase().includes(q) ||
        entry.description.toLowerCase().includes(q) ||
        entry.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
    const slugs = results.map((r) => r.slug);
    expect(slugs).toContain("openai");
    expect(slugs).toContain("anthropic");
  });

  it("filter by 'payments' returns stripe", () => {
    const q = "payments";
    const results = bundles.filter(({ slug }) => {
      const entry = (indexJson as { slug: string; name: string; description: string; tags: string[] }[]).find(
        (e) => e.slug === slug
      );
      if (!entry) return false;
      return (
        entry.name.toLowerCase().includes(q) ||
        entry.description.toLowerCase().includes(q) ||
        entry.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
    expect(results.map((r) => r.slug)).toContain("stripe");
  });

  it("filter by unknown term returns empty", () => {
    const q = "zzznomatch999";
    const results = bundles.filter(({ slug }) => {
      const entry = (indexJson as { slug: string; name: string; description: string; tags: string[] }[]).find(
        (e) => e.slug === slug
      );
      if (!entry) return false;
      return (
        entry.name.toLowerCase().includes(q) ||
        entry.description.toLowerCase().includes(q) ||
        entry.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
    expect(results).toHaveLength(0);
  });
});
