// apps/web/src/features/import/PostmanImport.tsx
// Drop-zone modal for importing a Postman Collection v2.1 JSON file.

import { useRef, useState } from 'react'
import {
  Alert,
  Badge,
  Button,
  Divider,
  Group,
  List,
  Loader,
  Modal,
  ScrollArea,
  Stack,
  Text,
  ThemeIcon,
} from '@mantine/core'
import {
  IconAlertCircle,
  IconCheck,
  IconFileImport,
  IconFolderOpen,
  IconUpload,
} from '@tabler/icons-react'
import { importPostman } from '@runbook/shared'
import type { ProjectBundle } from '../../projects/types'
import { ProjectBundleSchema } from '../../projects/types'

type Props = {
  opened: boolean
  onClose: () => void
  onImport: (bundle: ProjectBundle) => void
}

type Step = 'drop' | 'preview' | 'importing' | 'done'

type Preview = {
  bundle: ProjectBundle
  fileName: string
}

export function PostmanImport({ opened, onClose, onImport }: Props) {
  const [step, setStep] = useState<Step>('drop')
  const [preview, setPreview] = useState<Preview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)

  const collectionInputRef = useRef<HTMLInputElement>(null)
  const envInputRef = useRef<HTMLInputElement>(null)

  function reset() {
    setStep('drop')
    setPreview(null)
    setError(null)
    setDragging(false)
  }

  function handleClose() {
    reset()
    onClose()
  }

  async function processFiles(collectionFile: File, envFile?: File) {
    setError(null)
    try {
      const collectionText = await collectionFile.text()
      let collectionJson: unknown
      try {
        collectionJson = JSON.parse(collectionText)
      } catch {
        setError('Could not parse the file as JSON. Please upload a valid Postman collection export.')
        return
      }

      let envJson: unknown
      if (envFile) {
        try {
          envJson = JSON.parse(await envFile.text())
        } catch {
          setError('Could not parse the environment file as JSON.')
          return
        }
      }

      const rawBundle = importPostman(collectionJson, envJson)

      // Validate through the web app's schema to catch any structural issues
      const result = ProjectBundleSchema.safeParse(rawBundle)
      if (!result.success) {
        const msgs = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
        setError(`Bundle validation failed:\n${msgs.join('\n')}`)
        return
      }

      setPreview({ bundle: result.data, fileName: collectionFile.name })
      setStep('preview')
    } catch (e) {
      setError((e as Error).message ?? 'Unexpected error during import.')
    }
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) void processFiles(file)
    e.target.value = ''
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) void processFiles(file)
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    setDragging(true)
  }

  function handleDragLeave() {
    setDragging(false)
  }

  function handleConfirm() {
    if (!preview) return
    setStep('importing')
    onImport(preview.bundle)
    setStep('done')
  }

  const version = preview?.bundle.versions[0]

  return (
    <Modal opened={opened} onClose={handleClose} title="Import from Postman" size="md">
      {step === 'drop' && (
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            Upload a Postman Collection v2.1 export (.json). Folders become scenarios, requests
            become blocks, and{' '}
            <Text span ff="monospace" size="sm">
              {'{{variables}}'}
            </Text>{' '}
            are preserved as-is.
          </Text>

          {/* Drop zone */}
          <Stack
            align="center"
            justify="center"
            gap="sm"
            p="xl"
            style={{
              border: `2px dashed var(--mantine-color-${dragging ? 'violet-5' : 'default-border'})`,
              borderRadius: 'var(--mantine-radius-md)',
              cursor: 'pointer',
              background: dragging ? 'var(--mantine-color-violet-0)' : undefined,
              transition: 'border-color 150ms, background 150ms',
            }}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => collectionInputRef.current?.click()}
          >
            <ThemeIcon size="xl" variant="light" color="violet" radius="md">
              <IconUpload size={24} />
            </ThemeIcon>
            <Text size="sm" fw={500}>
              Drop your collection JSON here
            </Text>
            <Text size="xs" c="dimmed">
              or click to browse
            </Text>
          </Stack>

          <Divider label="or" labelPosition="center" />

          <Button
            variant="default"
            leftSection={<IconFolderOpen size={16} />}
            onClick={() => collectionInputRef.current?.click()}
          >
            Browse for collection file
          </Button>

          {error && (
            <Alert color="red" icon={<IconAlertCircle size={16} />}>
              {error}
            </Alert>
          )}

          <input
            ref={collectionInputRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={handleFileInput}
          />
          <input ref={envInputRef} type="file" accept="application/json,.json" hidden />
        </Stack>
      )}

      {step === 'preview' && preview && (
        <Stack gap="md">
          <Group gap="xs">
            <ThemeIcon size="md" variant="light" color="teal" radius="md">
              <IconFileImport size={16} />
            </ThemeIcon>
            <Stack gap={0}>
              <Text size="sm" fw={600}>
                {preview.bundle.name}
              </Text>
              <Text size="xs" c="dimmed">
                {preview.fileName}
              </Text>
            </Stack>
          </Group>

          {version && (
            <>
              <Group gap="xs">
                <Badge color="teal" variant="light">
                  {version.blocks.length} block{version.blocks.length !== 1 ? 's' : ''}
                </Badge>
                <Badge color="violet" variant="light">
                  {version.scenarios.length} scenario{version.scenarios.length !== 1 ? 's' : ''}
                </Badge>
                {version.environments.length > 0 && (
                  <Badge color="amber" variant="light">
                    {version.environments.length} environment
                    {version.environments.length !== 1 ? 's' : ''}
                  </Badge>
                )}
              </Group>

              <Text size="xs" tt="uppercase" c="dimmed" fw={600}>
                Scenarios to be created
              </Text>
              <ScrollArea.Autosize mah={220}>
                <List
                  spacing="xs"
                  size="sm"
                  icon={
                    <ThemeIcon size={16} variant="light" color="violet" radius="xl">
                      <IconCheck size={10} />
                    </ThemeIcon>
                  }
                >
                  {version.scenarios.map((s) => (
                    <List.Item key={s.id}>
                      <Text size="sm" span>
                        {s.name}
                      </Text>
                      <Text size="xs" c="dimmed" span>
                        {' '}
                        — {s.blocks.length} request{s.blocks.length !== 1 ? 's' : ''}
                      </Text>
                    </List.Item>
                  ))}
                </List>
              </ScrollArea.Autosize>
            </>
          )}

          {error && (
            <Alert color="red" icon={<IconAlertCircle size={16} />}>
              {error}
            </Alert>
          )}

          <Group justify="space-between">
            <Button variant="subtle" onClick={reset}>
              Back
            </Button>
            <Button leftSection={<IconFileImport size={16} />} onClick={handleConfirm}>
              Import bundle
            </Button>
          </Group>
        </Stack>
      )}

      {step === 'importing' && (
        <Stack align="center" gap="md" py="xl">
          <Loader size="md" color="violet" />
          <Text size="sm" c="dimmed">
            Importing…
          </Text>
        </Stack>
      )}

      {step === 'done' && (
        <Stack align="center" gap="md" py="xl">
          <ThemeIcon size="xl" color="green" variant="light" radius="md">
            <IconCheck size={24} />
          </ThemeIcon>
          <Text size="sm" fw={500}>
            Bundle imported successfully
          </Text>
          <Button onClick={handleClose}>Close</Button>
        </Stack>
      )}
    </Modal>
  )
}
