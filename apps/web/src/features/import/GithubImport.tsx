// apps/web/src/features/import/GithubImport.tsx
// Modal for importing a ProjectBundle from a GitHub repo or raw bundle URL.
import { useState } from 'react'
import {
  Alert,
  Button,
  Loader,
  Modal,
  Stack,
  Text,
  TextInput,
} from '@mantine/core'
import { IconAlertCircle, IconBrandGithub, IconCloudDownload } from '@tabler/icons-react'
import { ProjectBundleSchema, type ProjectBundle } from '../../projects/types'

// ---------------------------------------------------------------------------
// URL resolution
// ---------------------------------------------------------------------------

/**
 * Resolve any GitHub-flavoured URL to a raw `runbook.json` URL.
 *
 * Supported input forms:
 *   1. Raw URL already:
 *        https://raw.githubusercontent.com/owner/repo/branch/path.json
 *        → returned as-is
 *   2. GitHub repo URL (root):
 *        https://github.com/owner/repo
 *        → https://raw.githubusercontent.com/owner/repo/main/runbook.json
 *   3. GitHub repo URL with branch:
 *        https://github.com/owner/repo/tree/branch
 *        → https://raw.githubusercontent.com/owner/repo/branch/runbook.json
 *   4. GitHub blob URL:
 *        https://github.com/owner/repo/blob/branch/path/to/file.json
 *        → https://raw.githubusercontent.com/owner/repo/branch/path/to/file.json
 *   5. Any other https:// URL → returned as-is (user supplies their own raw URL)
 */
export function resolveRawUrl(input: string): string {
  const trimmed = input.trim()

  // Already a raw GitHub URL
  if (trimmed.startsWith('https://raw.githubusercontent.com/')) {
    return trimmed
  }

  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    return trimmed // Let the fetch fail with a meaningful network error
  }

  if (url.hostname !== 'github.com') {
    return trimmed // Non-GitHub URL — use as-is
  }

  // github.com/owner/repo[/tree/branch][/blob/branch/path]
  // segments: ['', 'owner', 'repo', ...rest]
  const segments = url.pathname.split('/').filter(Boolean)
  if (segments.length < 2) return trimmed

  const [owner, repo] = segments

  // /blob/branch/path/to/file.json
  if (segments[2] === 'blob' && segments.length >= 4) {
    const branch = segments[3]
    const filePath = segments.slice(4).join('/')
    return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`
  }

  // /tree/branch
  if (segments[2] === 'tree' && segments.length >= 4) {
    const branch = segments[3]
    return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/runbook.json`
  }

  // Root repo URL → default to main/runbook.json
  return `https://raw.githubusercontent.com/${owner}/${repo}/main/runbook.json`
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type Props = {
  opened: boolean
  onClose: () => void
  onImport: (bundle: ProjectBundle) => void
}

export function GithubImportModal({ opened, onClose, onImport }: Props) {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function reset() {
    setUrl('')
    setLoading(false)
    setError(null)
  }

  function handleClose() {
    reset()
    onClose()
  }

  async function handleFetch() {
    const raw = url.trim()
    if (!raw) {
      setError('Please enter a URL.')
      return
    }

    const resolvedUrl = resolveRawUrl(raw)
    setLoading(true)
    setError(null)

    let text: string
    try {
      const res = await fetch(resolvedUrl)
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText} — ${resolvedUrl}`)
      }
      text = await res.text()
    } catch (e) {
      setLoading(false)
      setError((e as Error).message ?? 'Failed to fetch the bundle.')
      return
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      setLoading(false)
      setError('The response is not valid JSON. Make sure the URL points to a raw runbook.json file.')
      return
    }

    const result = ProjectBundleSchema.safeParse(parsed)
    if (!result.success) {
      setLoading(false)
      const issues = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
      setError(`Invalid bundle schema: ${issues}`)
      return
    }

    setLoading(false)
    onImport(result.data)
    handleClose()
  }

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title="Import from GitHub"
      size="md"
    >
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          Paste a GitHub repo URL or a direct link to a raw{' '}
          <Text component="span" ff="monospace" size="sm">
            runbook.json
          </Text>{' '}
          file.
        </Text>

        <TextInput
          label="GitHub or raw bundle URL"
          placeholder="https://github.com/owner/repo  or  https://raw.githubusercontent.com/…"
          leftSection={<IconBrandGithub size={16} />}
          value={url}
          onChange={(e) => { setUrl(e.currentTarget.value); setError(null) }}
          onKeyDown={(e) => { if (e.key === 'Enter') void handleFetch() }}
          disabled={loading}
          data-autofocus
        />

        {error && (
          <Alert color="red" icon={<IconAlertCircle size={16} />}>
            {error}
          </Alert>
        )}

        <Button
          leftSection={loading ? <Loader size={14} /> : <IconCloudDownload size={14} />}
          onClick={() => void handleFetch()}
          disabled={loading || !url.trim()}
        >
          {loading ? 'Fetching…' : 'Fetch & Import'}
        </Button>
      </Stack>
    </Modal>
  )
}
