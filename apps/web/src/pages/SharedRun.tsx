// apps/web/src/pages/SharedRun.tsx
// Read-only view of a shared run result, loaded via /s/:slug
import { useEffect, useState } from 'react'
import {
  Alert,
  Badge,
  Box,
  Button,
  Code,
  Group,
  Paper,
  Skeleton,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconAlertTriangle, IconCheck, IconClipboardList, IconDownload, IconX } from '@tabler/icons-react'
import { getShare, type ShareRecord } from '../api/share'
import { useProjectsStore } from '../projects/projectsStore'
import { useTeamStore } from '../teams/teamStore'

type Props = {
  slug: string
}

export function SharedRun({ slug }: Props) {
  const [share, setShare] = useState<ShareRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [forking, setForking] = useState(false)

  const { importBundleObject } = useProjectsStore()
  const { activeTeamId } = useTeamStore()

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    getShare(slug)
      .then((data) => {
        if (!cancelled) setShare(data)
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message ?? 'Share not found or has expired.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [slug])

  async function handleFork() {
    if (!share?.payload.bundle) {
      notifications.show({ color: 'gray', message: 'No bundle attached to this share.' })
      return
    }
    if (!activeTeamId) {
      notifications.show({ color: 'red', message: 'Sign in and select a team first.' })
      return
    }

    setForking(true)
    try {
      await importBundleObject(share.payload.bundle as never, activeTeamId)
      notifications.show({ color: 'green', title: 'Bundle imported!', message: 'The bundle has been added to your workspace.' })
    } catch (err) {
      notifications.show({ color: 'red', title: 'Import failed', message: (err as Error).message })
    } finally {
      setForking(false)
    }
  }

  // ── Loading ───────────────────────────────────────────────
  if (loading) {
    return (
      <Stack p="xl" maw={720} mx="auto" gap="md">
        <Skeleton height={32} w={240} />
        <Skeleton height={20} w={320} />
        <Skeleton height={120} />
        <Skeleton height={80} />
      </Stack>
    )
  }

  // ── Error ─────────────────────────────────────────────────
  if (error || !share) {
    return (
      <Stack p="xl" maw={720} mx="auto" gap="md" align="center" py="xl">
        <ThemeIcon size={56} radius="xl" variant="light" color="red">
          <IconAlertTriangle size={28} />
        </ThemeIcon>
        <Title order={3}>Share not found</Title>
        <Text c="dimmed" ta="center" maw={360}>
          {error ?? 'This share link has expired or does not exist.'}
        </Text>
        <Alert color="red" icon={<IconAlertTriangle size={16} />}>
          Share links expire after 30 days.
        </Alert>
      </Stack>
    )
  }

  const runResult = share.payload.runResult as Record<string, unknown> | null
  const isOk = runResult?.['status'] === 'ok'

  // ── Data ──────────────────────────────────────────────────
  return (
    <Stack p="xl" maw={720} mx="auto" gap="md">
      {/* Header */}
      <Group justify="space-between" wrap="nowrap">
        <Group gap="sm">
          <ThemeIcon size={40} radius="md" variant="light" color="violet">
            <IconClipboardList size={20} />
          </ThemeIcon>
          <Box>
            <Title order={3}>Shared Run Result</Title>
            <Text size="xs" c="dimmed">
              {share.payload.scenarioId ? `Scenario: ${share.payload.scenarioId}` : 'Shared run'}
              {' · '}
              Expires {new Date(share.expiresAt).toLocaleDateString()}
            </Text>
          </Box>
        </Group>

        {share.payload.bundle && (
          <Button
            variant="light"
            leftSection={<IconDownload size={14} />}
            loading={forking}
            onClick={handleFork}
          >
            Fork into my workspace
          </Button>
        )}
      </Group>

      {/* Run result summary */}
      {runResult && (
        <Paper withBorder>
          <Group gap="sm" mb="xs">
            <ThemeIcon size={24} radius="sm" variant="light" color={isOk ? 'green' : 'red'}>
              {isOk ? <IconCheck size={14} /> : <IconX size={14} />}
            </ThemeIcon>
            <Badge color={isOk ? 'green' : 'red'}>
              {isOk ? 'Success' : 'Error'}
            </Badge>
            {runResult['httpStatus'] !== undefined && (
              <Badge color="blue" variant="outline">
                HTTP {String(runResult['httpStatus'])}
              </Badge>
            )}
            {runResult['elapsedMs'] !== undefined && (
              <Text size="xs" c="dimmed">{String(runResult['elapsedMs'])} ms</Text>
            )}
          </Group>

          {runResult['error'] != null && (
            <Alert color="red" icon={<IconAlertTriangle size={14} />} mt="xs">
              {String(runResult['error'])}
            </Alert>
          )}

          {runResult['response'] !== undefined && (
            <Box mt="sm">
              <Text size="xs" fw={600} mb={4}>Response</Text>
              <Code block style={{ maxHeight: 240, overflow: 'auto', fontSize: 12 }}>
                {typeof runResult['response'] === 'string'
                  ? runResult['response']
                  : JSON.stringify(runResult['response'], null, 2)}
              </Code>
            </Box>
          )}
        </Paper>
      )}

      {/* Bundle info */}
      {share.payload.bundle && (
        <Paper withBorder>
          <Text size="xs" fw={600} mb={4}>Bundle</Text>
          <Group gap="xs">
            <Badge color="teal" variant="light">
              {(share.payload.bundle as { name?: string }).name ?? share.payload.bundleId ?? 'Bundle'}
            </Badge>
            {share.payload.bundleId && (
              <Text size="xs" c="dimmed" ff="monospace">{share.payload.bundleId}</Text>
            )}
          </Group>
        </Paper>
      )}

      <Text size="xs" c="dimmed" ta="center">
        Secrets and auth tokens have been redacted from this share.
      </Text>
    </Stack>
  )
}
