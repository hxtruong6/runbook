// apps/web/src/pages/SharedRun.tsx
// Read-only view of a shared run result, loaded via /s/:slug
// Supports two modes:
//   - <SharedRun slug="abc" />  — fetches via getShare, then renders the view
//   - <SharedRun data={...} onFork={...} />  — pure-render with provided data
import { useEffect, useState } from 'react'
import {
  Accordion,
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
import { useMediaQuery } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { IconAlertTriangle, IconCheck, IconClipboardList, IconDownload, IconShare, IconX } from '@tabler/icons-react'
import { getShare, type ShareRecord } from '../api/share'
import { useProjectsStore } from '../projects/projectsStore'
import { useTeamStore } from '../teams/teamStore'
import type { BlockRunResult } from '../blocks/types'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type BlockResultEntry = {
  label: string
  kind: string
  result: BlockRunResult
}

export type SharedRunData = {
  scenarioName: string
  runAt: string
  blockResults: BlockResultEntry[]
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type SlugProps = {
  slug: string
  data?: never
  onFork?: never
}

type DataProps = {
  data: SharedRunData
  onFork?: () => void
  slug?: never
}

type Props = SlugProps | DataProps

// ---------------------------------------------------------------------------
// Inner view — pure-render from SharedRunData
// ---------------------------------------------------------------------------

type ViewProps = {
  data: SharedRunData
  onFork?: () => void
  forkLoading?: boolean
}

function SharedRunView({ data, onFork, forkLoading }: ViewProps) {
  const isMobile = useMediaQuery('(max-width: 768px)') ?? false

  const sidePanelContent = (
    <>
      {data.blockResults.map((entry, idx) => {
        const result = entry.result
        const isOk = result.status === 'ok'

        return (
          <Paper key={idx} withBorder>
            <Group gap="sm" mb="xs">
              <ThemeIcon size={24} radius="sm" variant="light" color={isOk ? 'green' : 'red'}>
                {isOk ? <IconCheck size={14} /> : <IconX size={14} />}
              </ThemeIcon>
              <Badge color={isOk ? 'green' : 'red'}>
                {isOk ? 'Success' : 'Error'}
              </Badge>
              <Text size="sm" fw={500}>{entry.label}</Text>
              <Badge color="teal" variant="light">{entry.kind}</Badge>
              {result.httpStatus !== undefined && (
                <Badge color="sky" variant="outline">
                  HTTP {result.httpStatus}
                </Badge>
              )}
              {result.elapsedMs !== undefined && (
                <Text size="xs" c="dimmed">{result.elapsedMs} ms</Text>
              )}
            </Group>

            {'error' in result && result.error != null && (
              <Alert color="coral" icon={<IconAlertTriangle size={14} />} mt="xs">
                {String(result.error)}
              </Alert>
            )}

            {result.response !== undefined && (
              <Box mt="sm">
                <Text size="xs" fw={600} mb={4}>Response</Text>
                <div data-testid="json-viewer">
                  <Code block style={{ maxHeight: 240, overflow: 'auto', fontSize: 12 }}>
                    {typeof result.response === 'string'
                      ? result.response
                      : JSON.stringify(result.response, null, 2)}
                  </Code>
                </div>
              </Box>
            )}
          </Paper>
        )
      })}
    </>
  )

  return (
    <Stack p="xl" maw={900} mx="auto" gap="md">
      {/* Header */}
      <Group justify="space-between" wrap="nowrap">
        <Group gap="sm">
          <ThemeIcon size={40} radius="md" variant="light" color="indigo">
            <IconClipboardList size={20} />
          </ThemeIcon>
          <Box>
            <Title order={3}>{data.scenarioName}</Title>
            <Text size="xs" c="dimmed">
              Run at {new Date(data.runAt).toLocaleString()}
            </Text>
          </Box>
        </Group>

        <Group gap="xs">
          {onFork && (
            <Button
              data-testid="fork-button"
              variant="light"
              leftSection={<IconDownload size={14} />}
              loading={forkLoading}
              onClick={onFork}
              style={{ minHeight: 44 }}
            >
              Fork into my workspace
            </Button>
          )}
          <Button
            data-testid="share-button"
            variant="default"
            leftSection={<IconShare size={14} />}
            onClick={() => {
              void navigator.clipboard?.writeText(window.location.href)
            }}
            style={{ minHeight: 44 }}
          >
            Share
          </Button>
        </Group>
      </Group>

      {/* Responsive side panels */}
      {isMobile ? (
        <Stack data-testid="mobile-layout" gap="md">
          <Accordion data-testid="side-panels-accordion" variant="separated">
            <Accordion.Item value="results">
              <Accordion.Control>Block Results</Accordion.Control>
              <Accordion.Panel>
                <Stack gap="md">{sidePanelContent}</Stack>
              </Accordion.Panel>
            </Accordion.Item>
          </Accordion>
        </Stack>
      ) : (
        <Stack data-testid="desktop-side-panels" gap="md">
          {sidePanelContent}
        </Stack>
      )}

      <Text size="xs" c="dimmed" ta="center">
        Secrets and auth tokens have been redacted from this share.
      </Text>
    </Stack>
  )
}

// ---------------------------------------------------------------------------
// Slug-fetching wrapper — backwards-compatible with F3 usage
// ---------------------------------------------------------------------------

function SharedRunFromSlug({ slug }: { slug: string }) {
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
      notifications.show({ color: 'coral', message: 'Sign in and select a team first.' })
      return
    }

    setForking(true)
    try {
      await importBundleObject(share.payload.bundle as never, activeTeamId)
      notifications.show({ color: 'sage', title: 'Bundle imported!', message: 'The bundle has been added to your workspace.' })
    } catch (err) {
      notifications.show({ color: 'coral', title: 'Import failed', message: (err as Error).message })
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
        <ThemeIcon size={56} radius="xl" variant="light" color="coral">
          <IconAlertTriangle size={28} />
        </ThemeIcon>
        <Title order={3}>Share not found</Title>
        <Text c="dimmed" ta="center" maw={360}>
          {error ?? 'This share link has expired or does not exist.'}
        </Text>
        <Alert color="coral" icon={<IconAlertTriangle size={16} />}>
          Share links expire after 30 days.
        </Alert>
      </Stack>
    )
  }

  // Convert ShareRecord to SharedRunData for the view
  const runResult = share.payload.runResult as BlockRunResult | null
  const viewData: SharedRunData = {
    scenarioName: 'Shared Run Result',
    runAt: share.expiresAt, // best available timestamp
    blockResults: runResult
      ? [{ label: 'Run Result', kind: 'urlTemplate', result: runResult }]
      : [],
  }

  const hasFork = Boolean(share.payload.bundle)

  return (
    <SharedRunView
      data={viewData}
      onFork={hasFork ? handleFork : undefined}
      forkLoading={forking}
    />
  )
}

// ---------------------------------------------------------------------------
// Public export — routes to slug-fetch or pure-render based on props
// ---------------------------------------------------------------------------

export function SharedRun(props: Props) {
  if ('slug' in props && props.slug != null) {
    return <SharedRunFromSlug slug={props.slug} />
  }
  return <SharedRunView data={props.data} onFork={props.onFork} />
}
