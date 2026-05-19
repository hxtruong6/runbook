// apps/web/src/components/ImportFromRegistryModal.tsx
import { useEffect, useState, useRef } from 'react'
import {
  Alert, Badge, Button, Group, Loader, Modal, ScrollArea,
  Stack, Text, TextInput,
} from '@mantine/core'
import { IconSearch, IconCloudDownload, IconCheck } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { listRegistry, searchRegistry, getRegistryBundle, verifyRegistryBundle, type RegistryEntry } from '../api/registry'
import { useProjectsStore } from '../projects/projectsStore'
import { useTeamStore } from '../teams/teamStore'

type Props = {
  opened: boolean
  onClose: () => void
}

export function ImportFromRegistryModal({ opened, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [entries, setEntries] = useState<RegistryEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [installing, setInstalling] = useState<string | null>(null)
  const [installed, setInstalled] = useState<Set<string>>(new Set())
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { activeTeamId } = useTeamStore()
  const { importing } = useProjectsStore()

  async function fetchEntries(q: string) {
    setLoading(true)
    setError(null)
    try {
      const results = q.trim() ? await searchRegistry(q) : await listRegistry()
      setEntries(results)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!opened) return
    fetchEntries('')
  }, [opened])

  function handleQueryChange(q: string) {
    setQuery(q)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchEntries(q), 300)
  }

  async function handleInstall(entry: RegistryEntry) {
    if (!activeTeamId) return
    setInstalling(entry.bundleId)
    setError(null)
    try {
      const full = await getRegistryBundle(entry.bundleId)
      const { valid } = await verifyRegistryBundle(entry.bundleId, full.hash)
      if (!valid) throw new Error('Bundle hash verification failed — bundle may be corrupted')
      await useProjectsStore.getState().importBundleObject(full.bundle, activeTeamId)
      setInstalled((s) => new Set([...s, entry.bundleId]))
      notifications.show({ color: 'sage', message: `Installed "${entry.name}"` })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setInstalling(null)
    }
  }

  function handleClose() {
    setQuery('')
    setEntries([])
    setError(null)
    setInstalled(new Set())
    onClose()
  }

  return (
    <Modal opened={opened} onClose={handleClose} title="Import from Registry" size="lg">
      <Stack gap="md">
        <TextInput
          placeholder="Search bundles…"
          leftSection={<IconSearch size={16} />}
          value={query}
          onChange={(e) => handleQueryChange(e.currentTarget.value)}
        />

        {error && <Alert color="coral">{error}</Alert>}

        {loading ? (
          <Group justify="center" py="xl"><Loader size="sm" /></Group>
        ) : entries.length === 0 ? (
          <Text size="sm" c="dimmed" ta="center" py="xl">
            {query ? 'No bundles match your search.' : 'Registry is empty.'}
          </Text>
        ) : (
          <ScrollArea.Autosize mah={400}>
            <Stack gap="xs">
              {entries.map((entry) => (
                <Group key={entry.bundleId} justify="space-between" p="sm" style={{ border: '1px solid var(--mantine-color-default-border)', borderRadius: 'var(--mantine-radius-md)' }}>
                  <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
                    <Group gap="xs">
                      <Text size="sm" fw={600}>{entry.name}</Text>
                      <Badge size="xs" variant="light" color="teal">{entry.latestVersion}</Badge>
                    </Group>
                    {entry.description && (
                      <Text size="xs" c="dimmed" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {entry.description}
                      </Text>
                    )}
                    <Text size="xs" c="dimmed" ff="monospace">
                      {entry.hash.slice(0, 12)}…
                    </Text>
                  </Stack>
                  {installed.has(entry.bundleId) ? (
                    <Button size="xs" variant="light" color="sage" leftSection={<IconCheck size={14} />} disabled>
                      Installed
                    </Button>
                  ) : (
                    <Button
                      size="xs"
                      variant="light"
                      leftSection={<IconCloudDownload size={14} />}
                      loading={installing === entry.bundleId || importing}
                      onClick={() => handleInstall(entry)}
                    >
                      Install
                    </Button>
                  )}
                </Group>
              ))}
            </Stack>
          </ScrollArea.Autosize>
        )}
      </Stack>
    </Modal>
  )
}
