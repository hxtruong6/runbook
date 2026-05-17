// src/pages/Gallery.tsx
import { useState, useMemo } from "react";
import {
  Alert,
  Badge,
  Box,
  Card,
  Group,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  TextInput,
  Title,
  Button,
} from "@mantine/core";
import {
  IconAlertCircle,
  IconBooks,
  IconSearch,
} from "@tabler/icons-react";
import { DocumentHead } from "./DocumentHead";
import { useGalleryIndex } from "./useGallery";
import type { GalleryEntry } from "./useGallery";

interface GalleryProps {
  onNavigate: (path: string) => void;
}

function GalleryCard({
  entry,
  onNavigate,
}: {
  entry: GalleryEntry;
  onNavigate: (path: string) => void;
}) {
  return (
    <Card
      component="button"
      style={{ cursor: "pointer", textAlign: "left", width: "100%" }}
      onClick={() => onNavigate(`/gallery/${entry.slug}`)}
    >
      <Stack gap="sm">
        <Title order={3} size="h4">
          {entry.name}
        </Title>
        <Text size="sm" c="dimmed" lineClamp={2}>
          {entry.description}
        </Text>
        <Group gap="xs" wrap="wrap">
          {entry.tags.map((tag) => (
            <Badge key={tag} color="violet" size="xs">
              {tag}
            </Badge>
          ))}
        </Group>
        <Group gap="md">
          <Text size="xs" c="dimmed">
            {entry.blockCount} block{entry.blockCount !== 1 ? "s" : ""}
          </Text>
          <Text size="xs" c="dimmed">
            {entry.scenarioCount} scenario{entry.scenarioCount !== 1 ? "s" : ""}
          </Text>
          <Text size="xs" c="dimmed">
            v{entry.version}
          </Text>
        </Group>
      </Stack>
    </Card>
  );
}

function LoadingSkeleton() {
  return (
    <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} height={160} />
      ))}
    </SimpleGrid>
  );
}

export function Gallery({ onNavigate }: GalleryProps) {
  const [search, setSearch] = useState("");
  const indexState = useGalleryIndex();

  const filtered = useMemo(() => {
    if (indexState.status !== "loaded") return [];
    const q = search.toLowerCase().trim();
    if (!q) return indexState.entries;
    return indexState.entries.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        e.tags.some((t) => t.toLowerCase().includes(q))
    );
  }, [indexState, search]);

  return (
    <>
      <DocumentHead
        title="Bundle Gallery — Runbook"
        description="Browse 8 ready-to-use API bundles for GitHub, OpenAI, Anthropic, Stripe, Slack, Linear, Notion, and Vercel."
      />
      <Box p="xl">
        <Stack gap="xl">
          <Stack gap="xs">
            <Title order={1}>Bundle Gallery</Title>
            <Text c="dimmed">
              Ready-to-use API bundles. Click any card to preview blocks and
              scenarios, then load into your workspace.
            </Text>
          </Stack>

          <TextInput
            placeholder="Search by name or tag…"
            leftSection={<IconSearch size={16} />}
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            style={{ maxWidth: 400 }}
          />

          {indexState.status === "loading" && <LoadingSkeleton />}

          {indexState.status === "error" && (
            <Alert
              icon={<IconAlertCircle size={16} />}
              color="red"
              title="Failed to load gallery"
            >
              {indexState.message}
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

          {indexState.status === "loaded" && filtered.length === 0 && (
            <Stack align="center" gap="sm" py="xl">
              <IconBooks size={48} color="var(--mantine-color-gray-4)" />
              <Title order={3}>No bundles found</Title>
              <Text c="dimmed" size="sm">
                Try a different search term.
              </Text>
              <Button variant="light" onClick={() => setSearch("")}>
                Clear search
              </Button>
            </Stack>
          )}

          {indexState.status === "loaded" && filtered.length > 0 && (
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
              {filtered.map((entry) => (
                <GalleryCard
                  key={entry.slug}
                  entry={entry}
                  onNavigate={onNavigate}
                />
              ))}
            </SimpleGrid>
          )}
        </Stack>
      </Box>
    </>
  );
}
