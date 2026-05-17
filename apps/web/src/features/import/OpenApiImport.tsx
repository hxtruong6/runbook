/**
 * OpenApiImport — Modal for importing an OpenAPI 3.x spec into a ProjectBundle.
 *
 * Features:
 *  - URL input field to fetch a remote spec
 *  - File drop zone accepting .json / .yaml
 *  - Loading / Error / Preview states
 *  - Preview pane: operations grouped by tag with checkboxes (all selected by default)
 *  - Confirm → creates bundle with only selected operations → loads into workspace
 */
import { useCallback, useRef, useState } from 'react'
import {
  Alert,
  Badge,
  Box,
  Button,
  Checkbox,
  Divider,
  Group,
  Modal,
  ScrollArea,
  Skeleton,
  Stack,
  Text,
  TextInput,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconUpload, IconWorld, IconAlertTriangle } from '@tabler/icons-react'
import { importOpenApi } from '@runbook/shared'
import type { ProjectBundle } from '../../projects/types'
import { useProjectsStore } from '../../projects/projectsStore'
import { useTeamStore } from '../../teams/teamStore'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TagGroup {
  tag: string
  operationKinds: string[]
}

interface PreviewState {
  bundle: ProjectBundle
  groups: TagGroup[]
  selected: Set<string> // Set of operation kinds that are selected
}

interface OpenApiImportProps {
  opened: boolean
  onClose: () => void
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildGroupsFromBundle(bundle: ProjectBundle): TagGroup[] {
  const version = bundle.versions[0]
  if (!version) return []

  const groups: TagGroup[] = version.scenarios.map((scenario) => ({
    tag: scenario.name,
    operationKinds: scenario.blocks.map((b) => b.kind),
  }))

  return groups
}

/**
 * Re-run importOpenApi with a kind-level filter applied.
 * Since importOpenApi accepts plain objects, we pass a filtered doc.
 * Simpler: rebuild from the already-parsed bundle by filtering blocks/scenarios.
 */
function filterBundle(bundle: ProjectBundle, selectedKinds: Set<string>): ProjectBundle {
  const version = bundle.versions[0]
  if (!version) return bundle

  const filteredBlocks = version.blocks.filter((b) => selectedKinds.has(b.kind))
  const filteredScenarios = version.scenarios
    .map((s) => ({
      ...s,
      blocks: s.blocks.filter((b) => selectedKinds.has(b.kind)),
    }))
    .filter((s) => s.blocks.length > 0)

  return {
    ...bundle,
    versions: [
      {
        ...version,
        blocks: filteredBlocks,
        scenarios: filteredScenarios,
        changes: version.changes.filter(
          (c) => !c.target || selectedKinds.has(c.target),
        ),
      },
    ],
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function OpenApiImport({ opened, onClose }: OpenApiImportProps) {
  const { importBundleObject, importing } = useProjectsStore()
  const { activeTeamId } = useTeamStore()

  const [urlInput, setUrlInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<PreviewState | null>(null)
  const [dragging, setDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Reset state on close ──────────────────────────────────────────────────

  function handleClose() {
    setUrlInput('')
    setLoading(false)
    setError(null)
    setPreview(null)
    onClose()
  }

  // ── Parse helpers ─────────────────────────────────────────────────────────

  async function parseDoc(docOrUrl: unknown) {
    setLoading(true)
    setError(null)
    setPreview(null)

    try {
      const bundle = (await importOpenApi(docOrUrl)) as unknown as ProjectBundle
      const groups = buildGroupsFromBundle(bundle)
      const allKinds = new Set<string>(bundle.versions[0]?.blocks.map((b) => b.kind) ?? [])

      setPreview({ bundle, groups, selected: allKinds })
    } catch (e) {
      setError((e as Error).message ?? 'Failed to parse OpenAPI spec')
    } finally {
      setLoading(false)
    }
  }

  async function handleFetchUrl() {
    const url = urlInput.trim()
    if (!url) return
    // Fetch with the browser instead of letting swagger-parser do the
    // download — its built-in fetcher relies on Node's Buffer global and
    // throws "Buffer is not defined" when run in a browser.
    setLoading(true)
    setError(null)
    setPreview(null)
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`)
      const doc: unknown = await res.json()
      setLoading(false)
      await parseDoc(doc)
    } catch (e) {
      setLoading(false)
      const msg = (e as Error).message ?? ''
      // "Failed to fetch" / "Load failed" are network-level errors. Common
      // causes: server isn't running, CORS missing Access-Control-Allow-Origin,
      // or — frequent gotcha — the URL uses "localhost" which resolves to IPv6
      // ::1 while the server only listens on IPv4 0.0.0.0. The latter looks
      // identical to a CORS failure in DevTools, so spell it out.
      if (/failed to fetch|load failed|network/i.test(msg)) {
        const isLocalhost = /\/\/localhost(:|\/)/.test(url)
        setError(
          `Couldn't reach ${url}. ` +
          (isLocalhost
            ? 'Try replacing "localhost" with "127.0.0.1" — many local servers listen on IPv4 only while the browser resolves localhost to IPv6 first. '
            : '') +
          'Also check that the server is running and sends an Access-Control-Allow-Origin header for this app.',
        )
      } else {
        setError(msg || 'Failed to fetch OpenAPI spec')
      }
    }
  }

  // Common public OpenAPI specs as one-click loaders so first-time users
  // can try the import flow without hunting for a URL.
  const PRESET_SPECS: { label: string; url: string }[] = [
    { label: 'Petstore (Swagger demo)', url: 'https://petstore3.swagger.io/api/v3/openapi.json' },
    { label: 'GitHub REST API', url: 'https://raw.githubusercontent.com/github/rest-api-description/main/descriptions/api.github.com/api.github.com.json' },
    { label: 'Stripe API', url: 'https://raw.githubusercontent.com/stripe/openapi/master/openapi/spec3.json' },
    { label: 'cworld-be (local)', url: 'http://127.0.0.1:4000/documentation-json' },
  ]

  async function handleFile(file: File) {
    const text = await file.text()
    let doc: unknown
    try {
      doc = JSON.parse(text)
    } catch {
      // Try YAML — only attempt if we can find a simple key:value structure
      // For now we only support JSON directly; YAML requires a dedicated parser.
      setError('Could not parse file. Please provide a valid JSON OpenAPI spec.')
      return
    }
    await parseDoc(doc)
  }

  // ── Checkbox helpers ──────────────────────────────────────────────────────

  function toggleKind(kind: string) {
    if (!preview) return
    const next = new Set(preview.selected)
    if (next.has(kind)) {
      next.delete(kind)
    } else {
      next.add(kind)
    }
    setPreview({ ...preview, selected: next })
  }

  function toggleTag(tag: string) {
    if (!preview) return
    const group = preview.groups.find((g) => g.tag === tag)
    if (!group) return

    const next = new Set(preview.selected)
    const allSelected = group.operationKinds.every((k) => next.has(k))
    for (const kind of group.operationKinds) {
      if (allSelected) {
        next.delete(kind)
      } else {
        next.add(kind)
      }
    }
    setPreview({ ...preview, selected: next })
  }

  // ── Confirm ───────────────────────────────────────────────────────────────

  async function handleConfirm() {
    if (!preview || !activeTeamId) return

    const finalBundle = filterBundle(preview.bundle, preview.selected)

    try {
      await importBundleObject(finalBundle, activeTeamId)
      notifications.show({
        color: 'green',
        message: `Imported "${finalBundle.name}" (${preview.selected.size} operations)`,
      })
      handleClose()
    } catch (e) {
      setError((e as Error).message ?? 'Failed to import bundle')
    }
  }

  // ── Drag-and-drop ─────────────────────────────────────────────────────────

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setDragging(false)
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) await handleFile(file)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Render ────────────────────────────────────────────────────────────────

  const totalOps = preview?.bundle.versions[0]?.blocks.length ?? 0
  const selectedCount = preview?.selected.size ?? 0

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title="Import from OpenAPI"
      size="lg"
      // Keep the modal inside the viewport — without this it grows past
      // the bottom when the OpenAPI doc has 100+ operations and the user
      // can't reach Cancel/Import without scrolling the page itself.
      styles={{
        body: { maxHeight: 'calc(85vh - 60px)', overflowY: 'auto' },
      }}
    >
      <Stack gap="md">
        {/* URL input */}
        <Stack gap="xs">
          <Text size="sm" fw={500}>OpenAPI spec URL</Text>
          <Group gap="xs" align="flex-end">
            <TextInput
              flex={1}
              placeholder="https://petstore3.swagger.io/api/v3/openapi.json"
              leftSection={<IconWorld size={16} />}
              value={urlInput}
              onChange={(e) => setUrlInput(e.currentTarget.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleFetchUrl() }}
              disabled={loading}
            />
            <Button
              variant="light"
              onClick={handleFetchUrl}
              loading={loading}
              disabled={!urlInput.trim()}
            >
              Load
            </Button>
          </Group>
          {/* Quick presets so new users don't need to hunt for a URL. */}
          <Group gap={6} wrap="wrap">
            <Text size="xs" c="dimmed">Try:</Text>
            {PRESET_SPECS.map((preset) => (
              <Button
                key={preset.url}
                size="compact-xs"
                variant="subtle"
                onClick={() => {
                  setUrlInput(preset.url)
                  setError(null)
                }}
              >
                {preset.label}
              </Button>
            ))}
          </Group>
        </Stack>

        <Divider label="or upload a file" labelPosition="center" />

        {/* File drop zone */}
        <Box
          onClick={() => fileInputRef.current?.click()}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          style={{
            border: `2px dashed var(--mantine-color-${dragging ? 'violet-5' : 'default-border'})`,
            borderRadius: 'var(--mantine-radius-md)',
            padding: 'var(--mantine-spacing-md)',
            textAlign: 'center',
            cursor: 'pointer',
            background: dragging ? 'var(--mantine-color-violet-0)' : undefined,
            transition: 'border-color 150ms, background 150ms',
          }}
        >
          <Stack align="center" gap="xs">
            <IconUpload size={20} color="var(--mantine-color-dimmed)" />
            <Text size="sm" c="dimmed">
              Drop a <code>.json</code> OpenAPI file here, or click to select
            </Text>
          </Stack>
        </Box>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) {
              handleFile(file)
              e.target.value = ''
            }
          }}
        />

        {/* Loading skeleton */}
        {loading && (
          <Stack gap="xs">
            <Skeleton height={24} />
            <Skeleton height={24} />
            <Skeleton height={24} />
          </Stack>
        )}

        {/* Error state */}
        {error && (
          <Alert
            color="red"
            title="Import error"
            icon={<IconAlertTriangle size={16} />}
            withCloseButton
            onClose={() => setError(null)}
          >
            {error}
          </Alert>
        )}

        {/* Preview pane */}
        {preview && !loading && (
          <>
            <Divider />
            <Group justify="space-between">
              <Text size="sm" fw={600}>
                {selectedCount} / {totalOps} operations selected
              </Text>
              <Group gap="xs">
                <Button
                  variant="subtle"
                  size="xs"
                  onClick={() =>
                    setPreview({
                      ...preview,
                      selected: new Set(
                        preview.bundle.versions[0]?.blocks.map((b) => b.kind) ?? [],
                      ),
                    })
                  }
                >
                  Select all
                </Button>
                <Button
                  variant="subtle"
                  size="xs"
                  onClick={() => setPreview({ ...preview, selected: new Set() })}
                >
                  Deselect all
                </Button>
              </Group>
            </Group>

            <ScrollArea.Autosize mah={320}>
              <Stack gap="sm">
                {preview.groups.map((group) => {
                  const allTagSelected = group.operationKinds.every((k) =>
                    preview.selected.has(k),
                  )
                  const someTagSelected = group.operationKinds.some((k) =>
                    preview.selected.has(k),
                  )

                  return (
                    <Stack key={group.tag} gap={4}>
                      <Checkbox
                        checked={allTagSelected}
                        indeterminate={!allTagSelected && someTagSelected}
                        onChange={() => toggleTag(group.tag)}
                        label={
                          <Group gap="xs">
                            <Text size="sm" fw={600}>{group.tag}</Text>
                            <Badge size="xs" color="gray">{group.operationKinds.length}</Badge>
                          </Group>
                        }
                      />
                      <Stack gap={2} pl="xl">
                        {group.operationKinds.map((kind) => {
                          const block = preview.bundle.versions[0]?.blocks.find(
                            (b) => b.kind === kind,
                          )
                          return (
                            <Checkbox
                              key={kind}
                              checked={preview.selected.has(kind)}
                              onChange={() => toggleKind(kind)}
                              label={
                                <Group gap="xs" wrap="nowrap">
                                  <Badge
                                    size="xs"
                                    color="teal"
                                    variant="outline"
                                    style={{ fontFamily: 'monospace', textTransform: 'uppercase' }}
                                  >
                                    {block?.request.method ?? '?'}
                                  </Badge>
                                  <Text size="sm">{block?.label ?? kind}</Text>
                                </Group>
                              }
                            />
                          )
                        })}
                      </Stack>
                    </Stack>
                  )
                })}
              </Stack>
            </ScrollArea.Autosize>
          </>
        )}

        {/* Footer actions */}
        <Group justify="flex-end" gap="sm" pt="xs">
          <Button variant="subtle" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            loading={importing}
            disabled={!preview || selectedCount === 0 || !activeTeamId}
          >
            Import {selectedCount > 0 ? `${selectedCount} operation${selectedCount !== 1 ? 's' : ''}` : ''}
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}
