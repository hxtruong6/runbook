// src/pages/VersionsPage.tsx
// Route: rendered as a full-screen modal at /versions (SPA modal, no router)
// Left panel: chronological version list (latest first)
// Right panel: changes[] from the selected version (authoritative — from bundle)

import { useState } from "react";
import {
  Alert,
  Badge,
  Box,
  Button,
  Divider,
  Grid,
  Group,
  Modal,
  NavLink,
  ScrollArea,
  Skeleton,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from "@mantine/core";
import { IconClockHour4, IconGitBranch } from "@tabler/icons-react";
import { useProjectsStore } from "../projects/projectsStore";
import { sortVersionsDesc } from "../projects/semver";
import { ChangeList } from "../features/versions/ChangeList";
import type { ApiProjectVersion } from "../api/projects";

// ---------------------------------------------------------------------------
// VersionsPage (modal body — no AppShell wrapper)
// ---------------------------------------------------------------------------

function VersionList({
  versions,
  selectedVersion,
  onSelect,
}: {
  versions: ApiProjectVersion[];
  selectedVersion: string | null;
  onSelect: (v: string) => void;
}) {
  const sorted = sortVersionsDesc(versions);

  return (
    <ScrollArea h="100%" type="auto">
      <Stack gap={2} p="sm">
        {sorted.map((v, idx) => (
          <NavLink
            key={v.version}
            active={v.version === selectedVersion}
            onClick={() => onSelect(v.version)}
            style={{ borderRadius: "var(--mantine-radius-md)" }}
            label={
              <Group gap="xs" wrap="nowrap">
                <Text size="sm" fw={v.version === selectedVersion ? 600 : 400}>
                  {v.version}
                </Text>
                {idx === 0 && (
                  <Badge size="xs" color="violet">
                    latest
                  </Badge>
                )}
              </Group>
            }
            description={v.releasedAt.slice(0, 10)}
            rightSection={
              <Badge size="xs" variant="outline" color="gray">
                {v.changes?.length ?? 0}
              </Badge>
            }
          />
        ))}
      </Stack>
    </ScrollArea>
  );
}

function DiffPanel({
  version,
  projectName,
}: {
  version: ApiProjectVersion | null;
  projectName: string;
}) {
  if (!version) {
    return (
      <Stack align="center" justify="center" h="100%" gap="xs" p="xl">
        <ThemeIcon size={48} radius="xl" variant="light" color="gray">
          <IconGitBranch size={24} />
        </ThemeIcon>
        <Text fw={600}>Select a version</Text>
        <Text size="sm" c="dimmed" ta="center">
          Pick a version from the list to see its changes.
        </Text>
      </Stack>
    );
  }

  const formattedDate = version.releasedAt.slice(0, 10);

  return (
    <Stack gap="md" p="md" h="100%" style={{ overflow: "auto" }}>
      <Group justify="space-between" align="flex-start">
        <Stack gap={2}>
          <Title order={4}>{version.version}</Title>
          <Text size="xs" c="dimmed">
            Released {formattedDate} · {projectName}
          </Text>
        </Stack>
      </Group>

      {version.releaseNotes?.trim() && (
        <Text size="sm" c="dimmed">
          {version.releaseNotes}
        </Text>
      )}

      <Divider />

      <ChangeList
        versionLabel={version.version}
        changes={version.changes ?? []}
      />
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// VersionsPage
// ---------------------------------------------------------------------------

export interface VersionsPageProps {
  opened: boolean;
  onClose: () => void;
}

export function VersionsPage({ opened, onClose }: VersionsPageProps) {
  const { projects, activeProjectId, loading } = useProjectsStore();
  const project = projects.find((p) => p._id === activeProjectId) ?? null;

  const versions: ApiProjectVersion[] = project?.versions ?? [];
  const sorted = sortVersionsDesc(versions);

  const [selectedVersion, setSelectedVersion] = useState<string | null>(
    () => sorted[0]?.version ?? null,
  );

  const selectedVersionData =
    versions.find((v) => v.version === selectedVersion) ?? null;

  // Reset selection to latest whenever project changes
  const latestVersion = sorted[0]?.version ?? null;
  if (selectedVersion === null && latestVersion !== null) {
    setSelectedVersion(latestVersion);
  }

  // Empty state: bundle has only one version (or zero)
  const showEmpty = !loading && versions.length <= 1;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <IconClockHour4 size={18} />
          <Text fw={600}>Version history</Text>
          {project && (
            <Text size="sm" c="dimmed">
              — {project.name}
            </Text>
          )}
        </Group>
      }
      size="xl"
      styles={{ body: { padding: 0 } }}
    >
      {loading ? (
        <Stack p="md" gap="sm">
          <Skeleton height={32} />
          <Skeleton height={32} />
          <Skeleton height={32} />
        </Stack>
      ) : !project ? (
        <Stack p="md">
          <Alert color="blue">No project selected. Open a project first.</Alert>
        </Stack>
      ) : showEmpty ? (
        <Stack align="center" gap="md" py="xl" px="md">
          <ThemeIcon size={56} radius="xl" variant="light" color="gray">
            <IconClockHour4 size={28} />
          </ThemeIcon>
          <Text fw={600} size="lg">
            No version history yet
          </Text>
          <Text size="sm" c="dimmed" ta="center" maw={380}>
            This bundle only has a single version. Publish a new version to
            start tracking changes over time.
          </Text>
          <Button variant="default" onClick={onClose}>
            Close
          </Button>
        </Stack>
      ) : (
        <Grid gutter={0} style={{ minHeight: 480 }}>
          {/* Left: version list */}
          <Grid.Col
            span={4}
            style={{
              borderRight: "1px solid var(--mantine-color-default-border)",
            }}
          >
            <Box
              py="xs"
              px="sm"
              style={{
                borderBottom: "1px solid var(--mantine-color-default-border)",
              }}
            >
              <Text size="xs" tt="uppercase" c="dimmed" fw={600}>
                Versions ({versions.length})
              </Text>
            </Box>
            <Box style={{ height: 440 }}>
              <VersionList
                versions={versions}
                selectedVersion={selectedVersion}
                onSelect={setSelectedVersion}
              />
            </Box>
          </Grid.Col>

          {/* Right: diff / change list */}
          <Grid.Col span={8}>
            <Box style={{ height: 480, overflow: "auto" }}>
              <DiffPanel
                version={selectedVersionData}
                projectName={project.name}
              />
            </Box>
          </Grid.Col>
        </Grid>
      )}
    </Modal>
  );
}
