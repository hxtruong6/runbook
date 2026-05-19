// src/pages/GalleryDetail.tsx
import { useState } from "react";
import {
  Alert,
  Badge,
  Box,
  Button,
  Code,
  Divider,
  Group,
  Skeleton,
  Stack,
  Table,
  Text,
  Title,
  ActionIcon,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconAlertCircle,
  IconArrowLeft,
  IconCheck,
  IconCode,
  IconPlayerPlay,
  IconTag,
} from "@tabler/icons-react";
import { DocumentHead } from "./DocumentHead";
import { useGalleryBundle, useGalleryIndex } from "./useGallery";
import { useProjectsStore } from "../projects/projectsStore";
import { useTeamStore } from "../teams/teamStore";
import { ProjectBundleSchema } from "../projects/types";
import { MethodBadge } from "../components/MethodBadge";

interface GalleryDetailProps {
  slug: string;
  onNavigate: (path: string) => void;
}

function LoadingSkeleton() {
  return (
    <Stack gap="lg">
      <Skeleton height={32} width={240} />
      <Skeleton height={20} width={480} />
      <Skeleton height={120} />
      <Skeleton height={200} />
    </Stack>
  );
}

export function GalleryDetail({ slug, onNavigate }: GalleryDetailProps) {
  const bundleState = useGalleryBundle(slug);
  const indexState = useGalleryIndex();
  const { importBundleObject, importing } = useProjectsStore();
  const { activeTeamId } = useTeamStore();
  const [imported, setImported] = useState(false);

  const entry =
    indexState.status === "loaded"
      ? indexState.entries.find((e) => e.slug === slug)
      : undefined;

  const pageTitle =
    entry?.name ?? (bundleState.status === "loaded"
      ? bundleState.bundle.name
      : slug);

  async function handleOpenInRunbook() {
    if (bundleState.status !== "loaded") return;
    if (!activeTeamId) {
      notifications.show({
        color: "red",
        title: "No active team",
        message: "Sign in and select a team before loading a bundle.",
      });
      return;
    }

    const validation = ProjectBundleSchema.safeParse(bundleState.bundle);
    if (!validation.success) {
      notifications.show({
        color: "red",
        title: "Invalid bundle",
        message: "Bundle failed schema validation.",
      });
      return;
    }

    try {
      await importBundleObject(validation.data, activeTeamId);
      setImported(true);
      notifications.show({
        color: "green",
        icon: <IconCheck size={16} />,
        title: "Bundle loaded",
        message: `"${validation.data.name}" is now in your workspace.`,
      });
      onNavigate("/");
    } catch {
      notifications.show({
        color: "red",
        title: "Import failed",
        message: "Could not load the bundle into your workspace.",
      });
    }
  }

  const latestVersion =
    bundleState.status === "loaded"
      ? [...bundleState.bundle.versions].sort((a, b) =>
          b.version.localeCompare(a.version, undefined, { numeric: true })
        )[0]
      : undefined;

  return (
    <>
      <DocumentHead
        title={`${pageTitle} — Runbook Gallery`}
        description={entry?.description ?? `Runbook bundle for ${pageTitle}.`}
      />
      <Box p="xl">
        <Stack gap="xl">
          {/* Back button */}
          <Group>
            <ActionIcon
              aria-label="Back to gallery"
              onClick={() => onNavigate("/gallery")}
            >
              <IconArrowLeft size={18} />
            </ActionIcon>
            <Text size="sm" c="dimmed">
              Gallery
            </Text>
          </Group>

          {/* Loading */}
          {bundleState.status === "loading" && <LoadingSkeleton />}

          {/* Error */}
          {bundleState.status === "error" && (
            <Alert
              icon={<IconAlertCircle size={16} />}
              color="red"
              title="Failed to load bundle"
            >
              {bundleState.message}
              <Button
                variant="light"
                color="red"
                size="xs"
                mt="sm"
                onClick={() => window.location.reload()}
              >
                Retry
              </Button>
            </Alert>
          )}

          {/* Data */}
          {bundleState.status === "loaded" && latestVersion && (
            <Stack gap="xl">
              {/* Header */}
              <Stack gap="xs">
                <Group justify="space-between" align="flex-start">
                  <Stack gap="xs">
                    <Title order={1}>{bundleState.bundle.name}</Title>
                    {bundleState.bundle.description && (
                      <Text c="dimmed">{bundleState.bundle.description}</Text>
                    )}
                  </Stack>
                  <Button
                    leftSection={<IconPlayerPlay size={16} />}
                    onClick={handleOpenInRunbook}
                    loading={importing}
                    disabled={imported}
                  >
                    {imported ? "Loaded" : "Open in Runbook"}
                  </Button>
                </Group>

                <Group gap="sm">
                  <Badge color="teal">v{latestVersion.version}</Badge>
                  <Badge color="gray">
                    {latestVersion.blocks.length} block
                    {latestVersion.blocks.length !== 1 ? "s" : ""}
                  </Badge>
                  <Badge color="gray">
                    {latestVersion.scenarios.length} scenario
                    {latestVersion.scenarios.length !== 1 ? "s" : ""}
                  </Badge>
                  {entry?.tags.map((tag) => (
                    <Badge key={tag} color="violet" variant="outline">
                      <Group gap={4}>
                        <IconTag size={10} />
                        {tag}
                      </Group>
                    </Badge>
                  ))}
                </Group>
              </Stack>

              <Divider />

              {/* Blocks */}
              <Stack gap="sm">
                <Title order={2} size="h3">
                  <Group gap="xs">
                    <IconCode size={20} />
                    Blocks
                  </Group>
                </Title>
                <Table>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Kind</Table.Th>
                      <Table.Th>Label</Table.Th>
                      <Table.Th>Method</Table.Th>
                      <Table.Th>Endpoint</Table.Th>
                      <Table.Th>Auth</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {latestVersion.blocks.map((block) => (
                      <Table.Tr key={block.kind}>
                        <Table.Td>
                          <Code>{block.kind}</Code>
                        </Table.Td>
                        <Table.Td>{block.label}</Table.Td>
                        <Table.Td>
                          <MethodBadge method={block.request.method} />
                        </Table.Td>
                        <Table.Td>
                          <Code style={{ wordBreak: "break-all" }}>
                            {block.request.urlTemplate}
                          </Code>
                        </Table.Td>
                        <Table.Td>
                          <Badge color="gray" size="xs">
                            {block.auth}
                          </Badge>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Stack>

              <Divider />

              {/* Scenarios */}
              <Stack gap="sm">
                <Title order={2} size="h3">
                  Scenarios
                </Title>
                {latestVersion.scenarios.length === 0 ? (
                  <Text c="dimmed" size="sm">
                    No scenarios defined.
                  </Text>
                ) : (
                  <Stack gap="md">
                    {latestVersion.scenarios.map((scenario) => (
                      <Box key={scenario.id}>
                        <Text fw={600}>{scenario.name}</Text>
                        <Stack gap="xs" mt="xs">
                          {scenario.blocks.map((bi, idx) => (
                            <Group key={bi.id} gap="sm">
                              <Badge color="gray" size="xs" variant="outline">
                                {idx + 1}
                              </Badge>
                              <Code>{bi.kind}</Code>
                            </Group>
                          ))}
                        </Stack>
                      </Box>
                    ))}
                  </Stack>
                )}
              </Stack>

              <Divider />

              {/* Environments */}
              <Stack gap="sm">
                <Title order={2} size="h3">
                  Environments
                </Title>
                {latestVersion.environments.length === 0 ? (
                  <Text c="dimmed" size="sm">
                    No environments defined.
                  </Text>
                ) : (
                  <Table>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Name</Table.Th>
                        <Table.Th>Base URL</Table.Th>
                        <Table.Th>Auth Kind</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {latestVersion.environments.map((env) => (
                        <Table.Tr key={env.id}>
                          <Table.Td>{env.name}</Table.Td>
                          <Table.Td>
                            <Code>{env.baseUrl}</Code>
                          </Table.Td>
                          <Table.Td>
                            <Badge color="gray" size="xs">
                              {env.auth.kind}
                            </Badge>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                )}
              </Stack>

              {/* CTA footer */}
              <Group justify="center" py="md">
                <Button
                  size="md"
                  leftSection={<IconPlayerPlay size={18} />}
                  onClick={handleOpenInRunbook}
                  loading={importing}
                  disabled={imported}
                >
                  {imported ? "Bundle loaded" : "Open in Runbook"}
                </Button>
              </Group>
            </Stack>
          )}
        </Stack>
      </Box>
    </>
  );
}
