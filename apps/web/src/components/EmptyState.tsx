// src/components/EmptyState.tsx
// Canonical empty-state pattern: icon + title + helper + CTA + optional sample cards.
//
// Usage:
//   <EmptyState
//     icon={<IconClipboardList size={28} />}
//     title="No scenarios yet"
//     helper="Create a scenario or load one of our sample bundles to get started."
//     primaryCta={{ label: 'New scenario', onClick: handleNew }}
//     samples={[
//       { slug: 'github-rest', name: 'GitHub REST API' },
//       { slug: 'jsonplaceholder-crud', name: 'JSONPlaceholder CRUD' },
//     ]}
//     onLoadSample={async (slug) => { ... }}
//     loadingSample={loadingSlug}
//   />

import { useState, type ReactNode } from "react";
import {
  Stack,
  Text,
  Button,
  Group,
  ThemeIcon,
  Paper,
  Loader,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconSparkles } from "@tabler/icons-react";
import { useProjectsStore } from "../projects/projectsStore";
import { useTeamStore } from "../teams/teamStore";
import type { ProjectBundle } from "../projects/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SampleRef = {
  /** Must match a filename in /gallery/<slug>.bundle.json */
  slug: string;
  name: string;
};

type PrimaryCtaProps = {
  label: string;
  onClick: () => void;
  disabled?: boolean;
};

type EmptyStateProps = {
  icon: ReactNode;
  title: string;
  helper: string;
  primaryCta?: PrimaryCtaProps;
  /** Optional curated list of gallery samples to show as one-click loaders */
  samples?: SampleRef[];
  /** Override the team used for importBundleObject (falls back to store activeTeamId) */
  teamId?: string;
};

// ---------------------------------------------------------------------------
// EmptyState
// ---------------------------------------------------------------------------

export function EmptyState({
  icon,
  title,
  helper,
  primaryCta,
  samples,
  teamId: teamIdProp,
}: EmptyStateProps) {
  const { importBundleObject } = useProjectsStore();
  const { activeTeamId } = useTeamStore();
  const [loadingSlug, setLoadingSlug] = useState<string | null>(null);

  const teamId = teamIdProp ?? activeTeamId ?? "";

  async function handleLoadSample(slug: string, name: string) {
    if (!teamId) {
      notifications.show({
        color: "red",
        title: "No team selected",
        message: "Select a team before loading a sample.",
      });
      return;
    }

    setLoadingSlug(slug);
    try {
      const res = await fetch(`/gallery/${slug}.bundle.json`);
      if (!res.ok) throw new Error(`Failed to fetch bundle: ${res.statusText}`);
      const bundle = (await res.json()) as ProjectBundle;
      await importBundleObject(bundle, teamId);
      notifications.show({
        color: "green",
        title: "Sample loaded",
        message: `"${name}" was imported as a new project.`,
      });
    } catch (err) {
      notifications.show({
        color: "red",
        title: "Import failed",
        message: (err as Error).message,
      });
    } finally {
      setLoadingSlug(null);
    }
  }

  return (
    <Stack align="center" gap="md" py="xl" data-testid="empty-state">
      <ThemeIcon size={56} radius="xl" variant="light" color="gray">
        {icon}
      </ThemeIcon>

      <Stack align="center" gap={4}>
        <Text fw={600} size="lg">
          {title}
        </Text>
        <Text size="sm" c="dimmed" ta="center" maw={360}>
          {helper}
        </Text>
      </Stack>

      {primaryCta && (
        <Button
          onClick={primaryCta.onClick}
          disabled={primaryCta.disabled}
        >
          {primaryCta.label}
        </Button>
      )}

      {samples && samples.length > 0 && (
        <Stack align="center" gap="xs" mt="xs">
          <Group gap={4}>
            <IconSparkles size={14} color="var(--mantine-color-dimmed)" />
            <Text size="xs" c="dimmed" fw={500}>
              Or load a sample
            </Text>
          </Group>
          <Group gap="sm" justify="center">
            {samples.map((s) => (
              <Paper
                key={s.slug}
                withBorder
                p="sm"
                data-testid={`sample-card-${s.slug}`}
                style={{ cursor: loadingSlug ? "default" : "pointer", minWidth: 140, textAlign: "center" }}
                onClick={() => {
                  if (!loadingSlug) handleLoadSample(s.slug, s.name);
                }}
              >
                {loadingSlug === s.slug ? (
                  <Loader size="xs" />
                ) : (
                  <Text size="xs" fw={500}>
                    {s.name}
                  </Text>
                )}
              </Paper>
            ))}
          </Group>
        </Stack>
      )}
    </Stack>
  );
}
