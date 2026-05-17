/**
 * RunFromUrl — hash-router entry point for shared run links.
 * Parses #/run/<id> from the URL and renders the SharedRun page.
 *
 * When the run data is not available (e.g. direct link without context),
 * shows an empty state with a link back home.
 */
import { Box, Button, Stack, Text, ThemeIcon, Title } from "@mantine/core";
import { IconArrowLeft, IconPlayerPlay } from "@tabler/icons-react";
import { SharedRun, type SharedRunData } from "./SharedRun";

type Props = {
  /** Optional pre-loaded run data (for in-app navigation). Falls back to URL parse. */
  runData?: SharedRunData;
  onNavigateHome: () => void;
};

/**
 * Attempt to parse run data embedded in the URL hash.
 * Format: #/run/<base64-encoded-json>
 */
function parseRunDataFromHash(): SharedRunData | null {
  try {
    const hash = window.location.hash;
    const encoded = hash.replace(/^#\/run\/?/, "");
    if (!encoded) return null;
    const json = atob(encoded);
    return JSON.parse(json) as SharedRunData;
  } catch {
    return null;
  }
}

export function RunFromUrl({ runData, onNavigateHome }: Props) {
  const data = runData ?? parseRunDataFromHash();

  if (!data) {
    return (
      <Box p="xl" maw={480} mx="auto" mt="xl">
        <Stack align="center" gap="md">
          <ThemeIcon size={56} radius="xl" variant="light" color="gray">
            <IconPlayerPlay size={28} />
          </ThemeIcon>
          <Title order={3}>Run not found</Title>
          <Text size="sm" c="dimmed" ta="center">
            This shared run link is invalid or has expired. Go back to the
            workspace to view your runs.
          </Text>
          <Button
            leftSection={<IconArrowLeft size={16} />}
            variant="default"
            onClick={onNavigateHome}
          >
            Back to workspace
          </Button>
        </Stack>
      </Box>
    );
  }

  return (
    <SharedRun
      data={data}
      onFork={onNavigateHome}
    />
  );
}
