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
  Paper,
  ScrollArea,
  Skeleton,
  Stack,
  Text,
  TextInput,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconUpload, IconWorld, IconAlertTriangle, IconPlus, IconMinus, IconEdit, IconGitBranch, IconCopy } from '@tabler/icons-react'
import { importOpenApi } from '@runbook/shared'
import type { ProjectBundle } from '../../projects/types'
import type { BlockDefData } from '../../blocks/dataBlock'
import { useProjectsStore } from '../../projects/projectsStore'
import { useScenariosStore } from '../../scenarios/scenariosStore'
import { useTeamStore } from '../../teams/teamStore'
import {
  computeBlockDiff, affectedScenarios, suggestNextVersion,
  type BlockDiff, type AffectedScenario,
} from '../../projects/versionDiff'

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
  const { importBundleObject, appendVersionFromBundle, importing, projects } = useProjectsStore()
  const { scenarios } = useScenariosStore()
  const { activeTeamId } = useTeamStore()

  const [urlInput, setUrlInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<PreviewState | null>(null)
  const [dragging, setDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Duplicate-name resolution sub-flow. When the user clicks Import and a
  // project with the same name already exists, we surface a choice instead
  // of silently creating a duplicate or overwriting.
  interface DuplicateState {
    existingProjectId: string
    existingProjectName: string
    existingVersions: string[]
    diff: BlockDiff
    affected: AffectedScenario[]
    suggestedVersion: string
    finalBundle: ProjectBundle
  }
  const [duplicate, setDuplicate] = useState<DuplicateState | null>(null)

  // ── Reset state on close ──────────────────────────────────────────────────

  function handleClose() {
    setUrlInput('')
    setLoading(false)
    setError(null)
    setPreview(null)
    setDuplicate(null)
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

    // Check for an existing project with the same name on this team. If yes,
    // open the duplicate-resolution panel so the user picks a strategy.
    const existing = projects.find((p) => p.name === finalBundle.name)
    if (existing) {
      const existingBlocks =
        ((existing.versions ?? [])[existing.versions!.length - 1]?.blocks ?? []) as BlockDefData[]
      const nextBlocks = (finalBundle.versions[0]?.blocks ?? []) as BlockDefData[]
      const diff = computeBlockDiff(existingBlocks, nextBlocks)
      const removedKinds = new Set(diff.removed.map((b) => b.kind))
      // The scenarios store only holds the active project's scenarios. So we
      // can only surface the impact preview when the existing project is the
      // currently active one. For other projects the post-import notification
      // would still fire — but the user wouldn't see the diff up-front.
      const activeProjectId = useProjectsStore.getState().activeProjectId
      const projectScenarios =
        activeProjectId === existing._id ? scenarios : []
      const affected = affectedScenarios(projectScenarios, removedKinds)
      const existingVersions = (existing.versions ?? []).map((v) => v.version)
      setDuplicate({
        existingProjectId: existing._id,
        existingProjectName: existing.name,
        existingVersions,
        diff,
        affected,
        suggestedVersion: suggestNextVersion(existingVersions),
        finalBundle,
      })
      return
    }

    await doFreshImport(finalBundle)
  }

  async function doFreshImport(finalBundle: ProjectBundle) {
    if (!activeTeamId) return
    try {
      await importBundleObject(finalBundle, activeTeamId)
      notifications.show({
        color: 'green',
        title: 'Imported',
        message: `"${finalBundle.name}" — ${finalBundle.versions[0]?.blocks.length ?? 0} operations`,
      })
      handleClose()
    } catch (e) {
      setError((e as Error).message ?? 'Failed to import bundle')
    }
  }

  async function handleAppendAsVersion() {
    if (!duplicate || !activeTeamId) return
    try {
      await appendVersionFromBundle(
        duplicate.existingProjectId,
        duplicate.finalBundle,
        activeTeamId,
        duplicate.suggestedVersion,
      )
      // Primary success toast.
      notifications.show({
        color: 'green',
        title: `Added version ${duplicate.suggestedVersion}`,
        message: `${duplicate.diff.added.length} added, ${duplicate.diff.changed.length} changed, ${duplicate.diff.removed.length} removed`,
      })
      // Orphaned-reference warning if any scenarios still point at removed
      // kinds. Their blocks won't render until you remove them or the API
      // comes back — make sure the user knows before they hit "Run".
      if (duplicate.affected.length > 0) {
        const names = duplicate.affected.slice(0, 3).map((s) => `"${s.name}"`).join(', ')
        const more = duplicate.affected.length > 3 ? ` +${duplicate.affected.length - 3} more` : ''
        notifications.show({
          color: 'amber',
          autoClose: 12000,
          title: `${duplicate.affected.length} scenario${duplicate.affected.length === 1 ? '' : 's'} reference removed APIs`,
          message: `${names}${more} — blocks for removed operations will not run.`,
        })
      }
      handleClose()
    } catch (e) {
      setError((e as Error).message ?? 'Failed to append version')
    }
  }

  async function handleCreateSeparate() {
    if (!duplicate) return
    // Suffix the name so the user can tell them apart in the project switcher.
    const base = duplicate.existingProjectName
    const existingNames = new Set(projects.map((p) => p.name))
    let suffix = 2
    while (existingNames.has(`${base} (${suffix})`)) suffix++
    const renamed: ProjectBundle = { ...duplicate.finalBundle, name: `${base} (${suffix})` }
    setDuplicate(null)
    await doFreshImport(renamed)
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

  if (duplicate) {
    return (
      <Modal
        opened={opened}
        onClose={handleClose}
        title={`"${duplicate.existingProjectName}" already exists`}
        size="lg"
        styles={{ body: { maxHeight: 'calc(85vh - 60px)', overflowY: 'auto' } }}
      >
        <DuplicateResolution
          state={duplicate}
          importing={importing}
          onAppend={handleAppendAsVersion}
          onSeparate={handleCreateSeparate}
          onBack={() => setDuplicate(null)}
        />
      </Modal>
    )
  }

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
          {/* Hint for users with a local backend. Each path keyword is a
              one-click template — populates http://127.0.0.1:PORT/<path>
              into the URL field so the user only has to edit the port. */}
          <Text size="xs" c="dimmed">
            Local backend? Try{' '}
            <Text component="span" ff="monospace">http://127.0.0.1:PORT/</Text>
            {' followed by '}
            {(['openapi.json', 'swagger.json', 'documentation-json'] as const).map((path, i, arr) => (
              <span key={path}>
                <Text
                  component="span"
                  ff="monospace"
                  c="violet"
                  style={{ cursor: 'pointer', textDecoration: 'underline' }}
                  onClick={() => {
                    setUrlInput(`http://127.0.0.1:PORT/${path}`)
                    setError(null)
                  }}
                  role="button"
                  aria-label={`Use ${path} template`}
                >
                  {path}
                </Text>
                {i < arr.length - 2 ? ', ' : i === arr.length - 2 ? ', or ' : ''}
              </span>
            ))}
            {' (last one is NestJS default).'}
          </Text>
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

// ---------------------------------------------------------------------------
// Duplicate-resolution panel
// ---------------------------------------------------------------------------

interface DuplicateResolutionProps {
  state: {
    existingProjectName: string
    existingVersions: string[]
    diff: BlockDiff
    affected: AffectedScenario[]
    suggestedVersion: string
    finalBundle: ProjectBundle
  }
  importing: boolean
  onAppend: () => void
  onSeparate: () => void
  onBack: () => void
}

function DiffSummaryRow({
  icon, color, count, label,
}: { icon: React.ReactNode; color: string; count: number; label: string }) {
  return (
    <Group gap="xs" wrap="nowrap">
      <Badge color={color} variant="light" leftSection={icon} size="lg" radius="sm">
        {count}
      </Badge>
      <Text size="sm" c="dimmed">{label}</Text>
    </Group>
  )
}

function DuplicateResolution({
  state, importing, onAppend, onSeparate, onBack,
}: DuplicateResolutionProps) {
  const { diff, affected, suggestedVersion, existingVersions } = state
  const latestExisting = existingVersions[existingVersions.length - 1] ?? '—'

  return (
    <Stack gap="md">
      <Alert
        color="violet"
        icon={<IconGitBranch size={18} />}
        title={`A project named "${state.existingProjectName}" already exists`}
      >
        <Text size="sm">
          You can add this import as a <strong>new version</strong> (recommended — your
          scenarios, run history, and edits stay intact) or create it as a separate project.
        </Text>
      </Alert>

      {/* Diff summary */}
      <Paper p="md" radius="md" withBorder>
        <Stack gap="xs">
          <Group justify="space-between">
            <Text size="sm" fw={600}>
              Changes vs current version{' '}
              <Text component="span" ff="monospace" c="dimmed">{latestExisting}</Text>
            </Text>
            <Text size="xs" c="dimmed">{diff.unchanged} unchanged</Text>
          </Group>
          <Group gap="lg" wrap="wrap">
            <DiffSummaryRow icon={<IconPlus size={12} />} color="green"
              count={diff.added.length} label="new" />
            <DiffSummaryRow icon={<IconEdit size={12} />} color="amber"
              count={diff.changed.length} label="changed" />
            <DiffSummaryRow icon={<IconMinus size={12} />} color="red"
              count={diff.removed.length} label="removed" />
          </Group>

          {(diff.added.length > 0 || diff.changed.length > 0 || diff.removed.length > 0) && (
            <ScrollArea.Autosize mah={200} mt="xs">
              <Stack gap={6}>
                {diff.removed.slice(0, 20).map((b) => (
                  <Group key={`r-${b.kind}`} gap={6} wrap="nowrap">
                    <IconMinus size={12} color="var(--mantine-color-red-6)" />
                    <Badge size="xs" color="red" variant="light" ff="monospace">{b.request.method}</Badge>
                    <Text size="xs" ff="monospace" c="dimmed" truncate>{b.request.urlTemplate}</Text>
                  </Group>
                ))}
                {diff.changed.slice(0, 20).map((c) => (
                  <Group key={`c-${c.kind}`} gap={6} wrap="nowrap">
                    <IconEdit size={12} color="var(--mantine-color-amber-7)" />
                    <Badge size="xs" color="amber" variant="light" ff="monospace">{c.next.request.method}</Badge>
                    <Text size="xs" ff="monospace" truncate>{c.next.request.urlTemplate}</Text>
                    <Text size="xs" c="dimmed" truncate>({c.reasons.join(', ')})</Text>
                  </Group>
                ))}
                {diff.added.slice(0, 20).map((b) => (
                  <Group key={`a-${b.kind}`} gap={6} wrap="nowrap">
                    <IconPlus size={12} color="var(--mantine-color-green-7)" />
                    <Badge size="xs" color="green" variant="light" ff="monospace">{b.request.method}</Badge>
                    <Text size="xs" ff="monospace" truncate>{b.request.urlTemplate}</Text>
                  </Group>
                ))}
                {diff.added.length + diff.changed.length + diff.removed.length > 60 && (
                  <Text size="xs" c="dimmed" fs="italic">… and more (truncated)</Text>
                )}
              </Stack>
            </ScrollArea.Autosize>
          )}
        </Stack>
      </Paper>

      {/* Affected scenarios warning */}
      {affected.length > 0 && (
        <Alert color="amber" icon={<IconAlertTriangle size={16} />}
          title={`${affected.length} scenario${affected.length === 1 ? '' : 's'} reference removed APIs`}>
          <Stack gap={2}>
            {affected.slice(0, 5).map((s) => (
              <Text key={s.id} size="xs">
                <strong>{s.name}</strong> — {s.orphanedKinds.length} orphaned block{s.orphanedKinds.length === 1 ? '' : 's'}
              </Text>
            ))}
            {affected.length > 5 && (
              <Text size="xs" c="dimmed">… and {affected.length - 5} more</Text>
            )}
            <Text size="xs" c="dimmed" mt={4}>
              Their existing edits and run history are preserved, but blocks for removed
              operations will not run. Remove them from the scenario or pick "Create as
              separate project" to keep both APIs side-by-side.
            </Text>
          </Stack>
        </Alert>
      )}

      <Divider />

      {/* Choice buttons */}
      <Stack gap="xs">
        <Button
          size="md"
          leftSection={<IconGitBranch size={18} />}
          onClick={onAppend}
          loading={importing}
        >
          Add as new version {suggestedVersion}
        </Button>
        <Text size="xs" c="dimmed" pl={4}>
          Appends to "{state.existingProjectName}". Scenarios, run history, edits, and inference data are preserved.
        </Text>

        <Button
          size="md"
          variant="default"
          leftSection={<IconCopy size={18} />}
          onClick={onSeparate}
          loading={importing}
          mt="xs"
        >
          Create as separate project
        </Button>
        <Text size="xs" c="dimmed" pl={4}>
          New project with an auto-suffixed name. Useful when you want to compare two APIs side-by-side.
        </Text>
      </Stack>

      <Group justify="flex-end" pt="xs">
        <Button variant="subtle" onClick={onBack} disabled={importing}>
          Back
        </Button>
      </Group>
    </Stack>
  )
}
