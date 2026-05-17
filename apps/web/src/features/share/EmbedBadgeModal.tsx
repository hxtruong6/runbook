// src/features/share/EmbedBadgeModal.tsx
// Embed badge generator.  Shows live previews of both badge variants and
// provides copy-ready Markdown / HTML / BBCode snippets.

import { useState } from 'react'
import {
  ActionIcon,
  Alert,
  Box,
  Button,
  Code,
  Divider,
  Group,
  Modal,
  ScrollArea,
  Stack,
  Tabs,
  Text,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconCheck, IconCopy } from '@tabler/icons-react'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Absolute base URL of this Runbook deployment. */
function getAppBase(): string {
  return `${window.location.protocol}//${window.location.host}`
}

/** The public CDN-style paths for the badge SVGs. */
const BADGE_LIGHT_PATH = '/docs/assets/badge-light.svg'
const BADGE_DARK_PATH = '/docs/assets/badge-dark.svg'

function buildRunUrl(bundleUrl: string, scenarioId: string): string {
  const base = getAppBase()
  const params = new URLSearchParams()
  if (bundleUrl) params.set('bundle', bundleUrl)
  if (scenarioId) params.set('scenario', scenarioId)
  return `${base}/#/run?${params.toString()}`
}

function generateMarkdown(bundleUrl: string, scenarioId: string, appBase: string): string {
  const runUrl = buildRunUrl(bundleUrl, scenarioId)
  const lightBadge = `${appBase}${BADGE_LIGHT_PATH}`
  return `[![Run in Runbook](${lightBadge})](${runUrl})`
}

function generateHtml(bundleUrl: string, scenarioId: string, appBase: string): string {
  const runUrl = buildRunUrl(bundleUrl, scenarioId)
  const lightBadge = `${appBase}${BADGE_LIGHT_PATH}`
  const darkBadge = `${appBase}${BADGE_DARK_PATH}`
  return `<a href="${runUrl}" target="_blank" rel="noopener noreferrer">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="${darkBadge}">
    <img src="${lightBadge}" alt="Run in Runbook" width="180" height="32">
  </picture>
</a>`
}

function generateBBCode(bundleUrl: string, scenarioId: string, appBase: string): string {
  const runUrl = buildRunUrl(bundleUrl, scenarioId)
  const lightBadge = `${appBase}${BADGE_LIGHT_PATH}`
  return `[url=${runUrl}][img]${lightBadge}[/img][/url]`
}

// ---------------------------------------------------------------------------
// BadgePreview
// ---------------------------------------------------------------------------

function BadgePreview({ bundleUrl, scenarioId }: { bundleUrl: string; scenarioId: string }) {
  const appBase = getAppBase()
  const lightBadge = `${appBase}${BADGE_LIGHT_PATH}`
  const darkBadge = `${appBase}${BADGE_DARK_PATH}`
  const runUrl = bundleUrl ? buildRunUrl(bundleUrl, scenarioId) : '#'

  return (
    <Stack gap="xs">
      <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Preview</Text>
      <Group gap="lg" align="center" wrap="wrap">
        <Stack gap={4} align="center">
          <Box
            style={{
              background: 'var(--mantine-color-white)',
              border: '1px solid var(--mantine-color-default-border)',
              borderRadius: 'var(--mantine-radius-md)',
              padding: '12px 16px',
              display: 'inline-flex',
            }}
          >
            <a href={runUrl} target="_blank" rel="noopener noreferrer">
              <img src={lightBadge} alt="Run in Runbook" width={180} height={32} />
            </a>
          </Box>
          <Text size="xs" c="dimmed">Light</Text>
        </Stack>
        <Stack gap={4} align="center">
          <Box
            style={{
              background: '#1C1B1F',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 'var(--mantine-radius-md)',
              padding: '12px 16px',
              display: 'inline-flex',
            }}
          >
            <a href={runUrl} target="_blank" rel="noopener noreferrer">
              <img src={darkBadge} alt="Run in Runbook" width={180} height={32} />
            </a>
          </Box>
          <Text size="xs" c="dimmed">Dark</Text>
        </Stack>
      </Group>
    </Stack>
  )
}

// ---------------------------------------------------------------------------
// CopyBlock
// ---------------------------------------------------------------------------

function CopyBlock({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true)
      notifications.show({ color: 'green', message: 'Copied to clipboard', autoClose: 1500 })
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <Box style={{ position: 'relative' }}>
      <ScrollArea>
        <Code block style={{ paddingRight: '2.5rem', whiteSpace: 'pre', fontSize: '0.78rem' }}>
          {value}
        </Code>
      </ScrollArea>
      <Tooltip label={copied ? 'Copied!' : 'Copy'} withinPortal>
        <ActionIcon
          aria-label="Copy snippet"
          size="sm"
          style={{ position: 'absolute', top: 8, right: 8 }}
          onClick={handleCopy}
          color={copied ? 'green' : undefined}
        >
          {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
        </ActionIcon>
      </Tooltip>
    </Box>
  )
}

// ---------------------------------------------------------------------------
// EmbedBadgeModal
// ---------------------------------------------------------------------------

type Props = {
  opened: boolean
  onClose: () => void
  /** Pre-fill: public URL of the bundle JSON. */
  defaultBundleUrl?: string
  /** Pre-fill: scenario ID to select after import. */
  defaultScenarioId?: string
}

export function EmbedBadgeModal({ opened, onClose, defaultBundleUrl = '', defaultScenarioId = '' }: Props) {
  const [bundleUrl, setBundleUrl] = useState(defaultBundleUrl)
  const [scenarioId, setScenarioId] = useState(defaultScenarioId)

  const appBase = getAppBase()
  const hasBundle = bundleUrl.trim().length > 0
  const isValidUrl = hasBundle && (() => { try { new URL(bundleUrl); return true } catch { return false } })()

  const mdSnippet = hasBundle ? generateMarkdown(bundleUrl.trim(), scenarioId.trim(), appBase) : ''
  const htmlSnippet = hasBundle ? generateHtml(bundleUrl.trim(), scenarioId.trim(), appBase) : ''
  const bbcodeSnippet = hasBundle ? generateBBCode(bundleUrl.trim(), scenarioId.trim(), appBase) : ''

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={<Title order={5}>Embed &ldquo;Run in Runbook&rdquo; badge</Title>}
      size="lg"
    >
      <Stack gap="md">
        {/* Inputs */}
        <TextInput
          label="Bundle URL"
          description="Public URL of the bundle JSON file (must have CORS headers)"
          placeholder="https://example.com/my-bundle.bundle.json"
          value={bundleUrl}
          onChange={(e) => setBundleUrl(e.currentTarget.value)}
          error={bundleUrl && !isValidUrl ? 'Enter a valid URL' : undefined}
        />
        <TextInput
          label="Scenario ID (optional)"
          description="Pre-select a specific scenario after import"
          placeholder="scenario-id"
          value={scenarioId}
          onChange={(e) => setScenarioId(e.currentTarget.value)}
        />

        {!hasBundle && (
          <Alert color="blue">
            Enter a bundle URL above to generate embed snippets.
          </Alert>
        )}

        {hasBundle && isValidUrl && (
          <>
            <Divider />
            <BadgePreview bundleUrl={bundleUrl.trim()} scenarioId={scenarioId.trim()} />
            <Divider />

            <Tabs defaultValue="markdown">
              <Tabs.List>
                <Tabs.Tab value="markdown">Markdown</Tabs.Tab>
                <Tabs.Tab value="html">HTML</Tabs.Tab>
                <Tabs.Tab value="bbcode">BBCode</Tabs.Tab>
              </Tabs.List>

              <Tabs.Panel value="markdown" pt="sm">
                <CopyBlock value={mdSnippet} />
              </Tabs.Panel>

              <Tabs.Panel value="html" pt="sm">
                <CopyBlock value={htmlSnippet} />
              </Tabs.Panel>

              <Tabs.Panel value="bbcode" pt="sm">
                <CopyBlock value={bbcodeSnippet} />
              </Tabs.Panel>
            </Tabs>
          </>
        )}

        <Group justify="flex-end">
          <Button variant="subtle" onClick={onClose}>Close</Button>
        </Group>
      </Stack>
    </Modal>
  )
}
