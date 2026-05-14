// src/components/OpenApiImporterModal.tsx
import { useState } from 'react'
import {
  Alert,
  Badge,
  Button,
  Checkbox,
  Group,
  Loader,
  Modal,
  ScrollArea,
  Stack,
  Tabs,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core'
import {
  IconAlertCircle,
  IconArrowLeft,
  IconCloudDownload,
  IconCode,
  IconLink,
} from '@tabler/icons-react'
import type { BlockDefData } from '../blocks/dataBlock'
import { parseOpenApi, type ImportedBlock } from '../blocks/openApiImporter'

type Props = {
  opened: boolean
  onClose: () => void
  onImport: (blocks: BlockDefData[]) => void
}

const METHOD_COLORS: Record<string, string> = {
  GET: 'blue',
  POST: 'green',
  PUT: 'amber',
  DELETE: 'red',
}

export function OpenApiImporterModal({ opened, onClose, onImport }: Props) {
  const [step, setStep] = useState<'input' | 'review'>('input')
  const [tab, setTab] = useState<string>('url')
  const [url, setUrl] = useState('')
  const [pasteText, setPasteText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [blocks, setBlocks] = useState<ImportedBlock[]>([])

  function reset() {
    setStep('input')
    setTab('url')
    setUrl('')
    setPasteText('')
    setLoading(false)
    setError(null)
    setBlocks([])
  }

  function handleClose() {
    reset()
    onClose()
  }

  function applyParsed(parsed: ImportedBlock[]) {
    if (parsed.length === 0) {
      setError('No operations found in the OpenAPI document. Make sure it has a valid "paths" object.')
      return
    }
    setBlocks(parsed)
    setError(null)
    setStep('review')
  }

  async function handleFetch() {
    if (!url.trim()) {
      setError('Please enter a URL.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(url.trim())
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`)
      const json: unknown = await res.json()
      applyParsed(parseOpenApi(json))
    } catch (e) {
      setError((e as Error).message ?? 'Failed to fetch or parse the OpenAPI document.')
    } finally {
      setLoading(false)
    }
  }

  function handleParse() {
    setError(null)
    let json: unknown
    try {
      json = JSON.parse(pasteText)
    } catch {
      setError('Invalid JSON. Please paste a valid OpenAPI 3.x JSON document.')
      return
    }
    applyParsed(parseOpenApi(json))
  }

  function toggleBlock(kind: string) {
    setBlocks((prev) =>
      prev.map((b) => (b.kind === kind ? { ...b, _selected: !b._selected } : b))
    )
  }

  function selectAll() {
    setBlocks((prev) => prev.map((b) => ({ ...b, _selected: true })))
  }

  function deselectAll() {
    setBlocks((prev) => prev.map((b) => ({ ...b, _selected: false })))
  }

  function handleImport() {
    const selected = blocks
      .filter((b) => b._selected)
      .map(({ _selected: _s, ...block }) => block as BlockDefData)
    onImport(selected)
    handleClose()
  }

  const selectedCount = blocks.filter((b) => b._selected).length
  const totalCount = blocks.length

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title="Import from OpenAPI"
      size="lg"
    >
      {step === 'input' && (
        <Stack gap="md">
          <Tabs value={tab} onChange={(v) => { setTab(v ?? 'url'); setError(null) }}>
            <Tabs.List>
              <Tabs.Tab value="url" leftSection={<IconLink size={14} />}>
                URL
              </Tabs.Tab>
              <Tabs.Tab value="paste" leftSection={<IconCode size={14} />}>
                Paste JSON
              </Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="url" pt="md">
              <Stack gap="sm">
                <TextInput
                  placeholder="https://petstore3.swagger.io/api/v3/openapi.json"
                  value={url}
                  onChange={(e) => setUrl(e.currentTarget.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') void handleFetch() }}
                  label="OpenAPI document URL"
                  description="The server must allow cross-origin requests (CORS). If fetch fails, use Paste JSON instead."
                />
                <Button
                  leftSection={loading ? <Loader size={14} /> : <IconCloudDownload size={14} />}
                  onClick={() => void handleFetch()}
                  disabled={loading || !url.trim()}
                >
                  {loading ? 'Fetching…' : 'Fetch'}
                </Button>
              </Stack>
            </Tabs.Panel>

            <Tabs.Panel value="paste" pt="md">
              <Stack gap="sm">
                <Textarea
                  label="OpenAPI JSON"
                  placeholder='{ "openapi": "3.0.0", "paths": { ... } }'
                  minRows={8}
                  autosize
                  value={pasteText}
                  onChange={(e) => setPasteText(e.currentTarget.value)}
                  styles={{ input: { fontFamily: 'monospace' } }}
                />
                <Button
                  onClick={handleParse}
                  disabled={!pasteText.trim()}
                >
                  Parse
                </Button>
              </Stack>
            </Tabs.Panel>
          </Tabs>

          {error && (
            <Alert color="red" icon={<IconAlertCircle size={16} />}>
              {error}
            </Alert>
          )}
        </Stack>
      )}

      {step === 'review' && (
        <Stack gap="md">
          <Group justify="space-between" align="center">
            <Text size="sm" c="dimmed">
              {selectedCount} / {totalCount} selected
            </Text>
            <Group gap="xs">
              <Button size="xs" variant="subtle" onClick={selectAll}>
                Select all
              </Button>
              <Button size="xs" variant="subtle" onClick={deselectAll}>
                Deselect all
              </Button>
            </Group>
          </Group>

          <ScrollArea.Autosize mah={400}>
            <Stack gap="xs">
              {blocks.map((block) => (
                <Group
                  key={block.kind}
                  gap="sm"
                  p="sm"
                  align="flex-start"
                  style={{
                    border: '1px solid var(--mantine-color-default-border)',
                    borderRadius: 'var(--mantine-radius-md)',
                  }}
                >
                  <Checkbox
                    checked={block._selected}
                    onChange={() => toggleBlock(block.kind)}
                    mt={2}
                    aria-label={`Select ${block.label}`}
                  />
                  <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
                    <Group gap="xs" wrap="nowrap">
                      <Badge
                        size="xs"
                        color={METHOD_COLORS[block.request.method] ?? 'gray'}
                      >
                        {block.request.method}
                      </Badge>
                      <Text size="sm" fw={500} style={{ flexShrink: 0 }}>
                        {block.label}
                      </Text>
                    </Group>
                    <Text
                      size="xs"
                      c="dimmed"
                      ff="monospace"
                      style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {block.request.urlTemplate}
                    </Text>
                  </Stack>
                </Group>
              ))}
            </Stack>
          </ScrollArea.Autosize>

          {error && (
            <Alert color="red" icon={<IconAlertCircle size={16} />}>
              {error}
            </Alert>
          )}

          <Group justify="space-between">
            <Group gap="xs">
              <Button
                variant="subtle"
                leftSection={<IconArrowLeft size={14} />}
                onClick={() => { setStep('input'); setError(null) }}
              >
                Back
              </Button>
              <Button variant="subtle" color="gray" onClick={reset}>
                Start over
              </Button>
            </Group>
            <Button
              onClick={handleImport}
              disabled={selectedCount === 0}
            >
              Import {selectedCount > 0 ? `${selectedCount} block${selectedCount !== 1 ? 's' : ''}` : ''}
            </Button>
          </Group>
        </Stack>
      )}
    </Modal>
  )
}
