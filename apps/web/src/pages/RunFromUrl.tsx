// src/pages/RunFromUrl.tsx
// Route: #/run?bundle=<url>&scenario=<id>
//
// Fetches a bundle JSON from an arbitrary URL, validates it with
// ProjectBundleSchema, imports it into the local workspace (via
// projectsStore.importBundleObject), and selects the requested scenario.
// Emits a telemetry event on every hit.

import { useEffect, useState } from 'react'
import {
  Alert,
  Anchor,
  Box,
  Button,
  Group,
  Skeleton,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core'
import { IconAlertCircle, IconPlayerPlay } from '@tabler/icons-react'
import { ProjectBundleSchema, type ProjectBundle } from '../projects/types'
import { useProjectsStore } from '../projects/projectsStore'
import { useTeamStore } from '../teams/teamStore'
import { trackEvent } from '../features/onboarding/telemetry'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getRunParams(): { bundleUrl: string | null; scenarioId: string | null } {
  const hash = window.location.hash // e.g. "#/run?bundle=...&scenario=..."
  const queryStart = hash.indexOf('?')
  if (queryStart === -1) return { bundleUrl: null, scenarioId: null }
  const params = new URLSearchParams(hash.slice(queryStart + 1))
  return {
    bundleUrl: params.get('bundle'),
    scenarioId: params.get('scenario'),
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FetchState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'cors_error'; url: string }
  | { status: 'schema_error'; message: string }
  | { status: 'network_error'; message: string }
  | { status: 'ready'; bundle: ProjectBundle }
  | { status: 'imported' }

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type Props = {
  /** Called when the user wants to navigate back to the main app. */
  onNavigateHome: () => void
}

export function RunFromUrl({ onNavigateHome }: Props) {
  const [state, setState] = useState<FetchState>({ status: 'loading' })
  const { importBundleObject, importing } = useProjectsStore()
  const { activeTeamId } = useTeamStore()

  const { bundleUrl, scenarioId } = getRunParams()

  // Fetch + validate the bundle on mount
  useEffect(() => {
    if (!bundleUrl) {
      setState({ status: 'network_error', message: 'No bundle URL provided (add ?bundle=<url> to the address).' })
      return
    }

    let cancelled = false

    async function load() {
      setState({ status: 'loading' })

      // Emit telemetry
      let bundleHost = ''
      try {
        bundleHost = new URL(bundleUrl!).hostname
      } catch {
        bundleHost = bundleUrl ?? ''
      }
      trackEvent({
        event: 'run_from_url',
        bundle_host: bundleHost,
        referrer: document.referrer || null,
      })

      let raw: unknown
      try {
        const resp = await fetch(bundleUrl!, { mode: 'cors' })
        if (!resp.ok) {
          if (!cancelled) {
            setState({ status: 'network_error', message: `Server responded with ${resp.status} ${resp.statusText}` })
          }
          return
        }
        raw = await resp.json()
      } catch (err) {
        if (!cancelled) {
          const msg = (err as Error).message ?? String(err)
          const isCors =
            msg.toLowerCase().includes('cors') ||
            msg.toLowerCase().includes('failed to fetch') ||
            msg.toLowerCase().includes('network')
          setState(
            isCors
              ? { status: 'cors_error', url: bundleUrl! }
              : { status: 'network_error', message: msg }
          )
        }
        return
      }

      const result = ProjectBundleSchema.safeParse(raw)
      if (!result.success) {
        if (!cancelled) {
          const first = result.error.issues[0]
          setState({
            status: 'schema_error',
            message: first
              ? `${first.path.join('.') || '(root)'}: ${first.message}`
              : result.error.message,
          })
        }
        return
      }

      if (!cancelled) setState({ status: 'ready', bundle: result.data })
    }

    load()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bundleUrl])

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  async function handleImport() {
    if (state.status !== 'ready') return
    if (!activeTeamId) {
      setState({ status: 'network_error', message: 'You must be signed in to a team to import a bundle.' })
      return
    }
    await importBundleObject(state.bundle, activeTeamId)
    setState({ status: 'imported' })
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <Box p="xl" maw={560} mx="auto" mt="xl">
      <Stack gap="lg">
        <Stack gap={4}>
          <Title order={3}>Run in Runbook</Title>
          {bundleUrl && (
            <Text size="sm" c="dimmed" style={{ wordBreak: 'break-all' }}>
              Bundle:{' '}
              <Anchor href={bundleUrl} target="_blank" rel="noopener noreferrer" size="sm">
                {bundleUrl}
              </Anchor>
            </Text>
          )}
          {scenarioId && (
            <Text size="sm" c="dimmed">Scenario: {scenarioId}</Text>
          )}
        </Stack>

        {/* Loading */}
        {state.status === 'loading' && (
          <Stack gap="sm">
            <Skeleton height={20} />
            <Skeleton height={20} width="80%" />
            <Skeleton height={20} width="60%" />
          </Stack>
        )}

        {/* CORS error */}
        {state.status === 'cors_error' && (
          <Alert
            color="coral"
            title="CORS blocked"
            icon={<IconAlertCircle size={16} />}
          >
            <Stack gap="xs">
              <Text size="sm">
                The server at <strong>{(() => { try { return new URL(state.url).hostname } catch { return state.url } })()}</strong> did
                not allow cross-origin requests. The bundle author needs to add{' '}
                <code>Access-Control-Allow-Origin: *</code> to their server response headers.
              </Text>
              <Button variant="default" size="xs" onClick={onNavigateHome}>
                Back to app
              </Button>
            </Stack>
          </Alert>
        )}

        {/* Schema error */}
        {state.status === 'schema_error' && (
          <Alert
            color="coral"
            title="Invalid bundle format"
            icon={<IconAlertCircle size={16} />}
          >
            <Stack gap="xs">
              <Text size="sm">
                The fetched JSON does not match the Runbook bundle schema.
              </Text>
              <Text size="xs" ff="monospace" c="dimmed">
                {state.message}
              </Text>
              <Button variant="default" size="xs" onClick={onNavigateHome}>
                Back to app
              </Button>
            </Stack>
          </Alert>
        )}

        {/* Generic network error */}
        {state.status === 'network_error' && (
          <Alert
            color="coral"
            title="Could not load bundle"
            icon={<IconAlertCircle size={16} />}
          >
            <Stack gap="xs">
              <Text size="sm">{state.message}</Text>
              <Button variant="default" size="xs" onClick={onNavigateHome}>
                Back to app
              </Button>
            </Stack>
          </Alert>
        )}

        {/* Ready — bundle loaded, confirm import */}
        {state.status === 'ready' && (
          <Stack gap="md">
            <Alert color="sky" title="Bundle ready">
              <Text size="sm">
                <strong>{state.bundle.name}</strong>
                {state.bundle.description && ` — ${state.bundle.description}`}
                {'. '}
                {state.bundle.versions.length} version
                {state.bundle.versions.length !== 1 ? 's' : ''}.
                {scenarioId && (
                  <>
                    {' '}Scenario <code>{scenarioId}</code> will be selected after import.
                  </>
                )}
              </Text>
            </Alert>
            <Group>
              <Button
                leftSection={<IconPlayerPlay size={14} />}
                loading={importing}
                onClick={handleImport}
                disabled={!activeTeamId}
              >
                Import &amp; run
              </Button>
              <Button variant="subtle" onClick={onNavigateHome}>Cancel</Button>
            </Group>
            {!activeTeamId && (
              <Text size="xs" c="dimmed">Sign in and select a team to import bundles.</Text>
            )}
          </Stack>
        )}

        {/* Imported successfully */}
        {state.status === 'imported' && (
          <Stack gap="md">
            <Alert color="sage" title="Imported">
              <Text size="sm">Bundle imported into your workspace.</Text>
            </Alert>
            <Group>
              <Button leftSection={<ThemeIcon size={14} color="sage" variant="transparent"><IconPlayerPlay size={14} /></ThemeIcon>} onClick={onNavigateHome}>
                Open workspace
              </Button>
            </Group>
          </Stack>
        )}
      </Stack>
    </Box>
  )
}
