// src/components/WhatsNewPanel.tsx
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  Accordion,
  Anchor,
  Badge,
  Group,
  Paper,
  Stack,
  Text,
  Title,
  TypographyStylesProvider,
} from "@mantine/core";
import { IconArrowRight } from "@tabler/icons-react";
import { useProjectsStore } from "../projects/projectsStore";
import type { ChangeEntry } from "../projects/types";
import { VersionsPage } from "../pages/VersionsPage";

// ---------------------------------------------------------------------------
// Badge color map
// ---------------------------------------------------------------------------
const CHANGE_TYPE_COLOR: Record<ChangeEntry["type"], string> = {
  added: "green",
  modified: "blue",
  deprecated: "amber",
  removed: "red",
  fixed: "gray",
  note: "gray",
};

// ---------------------------------------------------------------------------
// ChangeRow
// ---------------------------------------------------------------------------
function ChangeRow({ change }: { change: ChangeEntry }) {
  return (
    <Paper p="sm" withBorder>
      <Stack gap={4}>
        <Group gap="xs" wrap="nowrap">
          <Badge
            color={CHANGE_TYPE_COLOR[change.type]}
            variant="light"
            size="sm"
          >
            {change.type}
          </Badge>
          {change.breaking && (
            <Badge color="red" variant="filled" size="sm">
              BREAKING
            </Badge>
          )}
          <Text size="sm" fw={500}>
            {change.target ?? "—"}
          </Text>
        </Group>
        <Text size="sm">{change.summary}</Text>
        {change.removeBy && (
          <Text size="xs" c="dimmed">
            Will be removed in {change.removeBy}
          </Text>
        )}
      </Stack>
    </Paper>
  );
}

// ---------------------------------------------------------------------------
// WhatsNewPanel
// ---------------------------------------------------------------------------
export function WhatsNewPanel() {
  const [versionsOpen, setVersionsOpen] = useState(false);
  const { projects, activeProjectId } = useProjectsStore();
  const activeProject = projects.find((p) => p._id === activeProjectId) ?? null;

  if (!activeProject) {
    return (
      <Text size="sm" c="dimmed">
        No project selected.
      </Text>
    );
  }

  const latestVersion = activeProject.versions?.[0];

  if (!latestVersion) {
    return (
      <Stack gap="xs">
        <Title order={5}>{activeProject.name}</Title>
        <Text size="sm" c="dimmed">
          No version information available for this project.
        </Text>
      </Stack>
    );
  }

  const { version, releasedAt, releaseNotes, changes, docs } = latestVersion;
  const formattedDate = releasedAt.slice(0, 10);
  const sortedDocEntries = Object.entries(docs).sort(([a], [b]) => a.localeCompare(b));

  return (
    <Stack gap="md">
      {/* Header row */}
      <Group justify="space-between" align="flex-start">
        <Stack gap={2}>
          <Title order={4}>{version}</Title>
          <Text size="xs" c="dimmed">
            Released {formattedDate}
          </Text>
        </Stack>
        <Text size="sm" c="dimmed">
          {activeProject.name}
        </Text>
      </Group>

      {/* Release notes */}
      {releaseNotes.trim().length > 0 && (
        <Stack gap="xs">
          <Title order={6} c="dimmed" tt="uppercase">
            Release notes
          </Title>
          <TypographyStylesProvider>
            <ReactMarkdown>{releaseNotes}</ReactMarkdown>
          </TypographyStylesProvider>
        </Stack>
      )}

      {/* Changes */}
      {changes.length > 0 && (
        <Stack gap="xs">
          <Title order={6} c="dimmed" tt="uppercase">
            Changes ({changes.length})
          </Title>
          <Stack gap="xs">
            {changes.map((change, i) => (
              <ChangeRow key={i} change={change} />
            ))}
          </Stack>
        </Stack>
      )}

      {/* Per-block docs */}
      {sortedDocEntries.length > 0 && (
        <Stack gap="xs">
          <Title order={6} c="dimmed" tt="uppercase">
            Docs
          </Title>
          <Accordion variant="contained">
            {sortedDocEntries.map(([kind, markdown]) => (
              <Accordion.Item key={kind} value={kind}>
                <Accordion.Control>
                  <Text size="sm" fw={500}>
                    {kind}
                  </Text>
                </Accordion.Control>
                <Accordion.Panel>
                  <TypographyStylesProvider>
                    <ReactMarkdown>{markdown as string}</ReactMarkdown>
                  </TypographyStylesProvider>
                </Accordion.Panel>
              </Accordion.Item>
            ))}
          </Accordion>
        </Stack>
      )}

      {/* Footer: link to full version history */}
      <Group justify="flex-end">
        <Anchor
          size="sm"
          component="button"
          onClick={() => setVersionsOpen(true)}
          style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
        >
          View all changes
          <IconArrowRight size={14} />
        </Anchor>
      </Group>

      <VersionsPage
        opened={versionsOpen}
        onClose={() => setVersionsOpen(false)}
      />
    </Stack>
  );
}
