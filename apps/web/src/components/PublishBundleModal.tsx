// apps/web/src/components/PublishBundleModal.tsx
import { useState } from 'react'
import { Alert, Button, Code, Group, Modal, Stack, Text } from '@mantine/core'
import { IconCheck, IconCloudUpload } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useProjectsStore } from '../projects/projectsStore'
import { useScenariosStore } from '../scenarios/scenariosStore'
import { useTeamStore } from '../teams/teamStore'

type Props = {
  opened: boolean
  onClose: () => void
}

export function PublishBundleModal({ opened, onClose }: Props) {
  const { projects, activeProjectId, publishing } = useProjectsStore()
  const { scenarios } = useScenariosStore()
  const { activeTeamId } = useTeamStore()
  const [publishedHash, setPublishedHash] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const project = projects.find((p) => p._id === activeProjectId)

  async function handlePublish() {
    if (!activeTeamId) return
    setError(null)
    setPublishedHash(null)
    try {
      const result = await useProjectsStore.getState().publishBundle(activeTeamId, scenarios)
      setPublishedHash(result.hash)
      notifications.show({ color: 'green', message: `Published ${result.bundleId} @ ${result.latestVersion}` })
    } catch (e) {
      setError((e as Error).message)
    }
  }

  function handleClose() {
    setPublishedHash(null)
    setError(null)
    onClose()
  }

  return (
    <Modal opened={opened} onClose={handleClose} title="Publish to Registry">
      <Stack gap="md">
        {!project ? (
          <Alert color="red">No active project selected.</Alert>
        ) : publishedHash ? (
          <>
            <Alert color="green" icon={<IconCheck size={16} />} title="Published">
              <Text size="sm" mb={4}>Bundle published successfully.</Text>
              <Text size="xs" c="dimmed" mb={4}>SHA-256 hash:</Text>
              <Code block style={{ wordBreak: 'break-all', fontSize: 11 }}>{publishedHash}</Code>
            </Alert>
            <Button variant="default" onClick={handleClose}>Close</Button>
          </>
        ) : (
          <>
            <Stack gap={4}>
              <Text size="sm"><strong>Project:</strong> {project.name}</Text>
              <Text size="sm"><strong>Versions:</strong> {(project.versions ?? []).length || '—'}</Text>
              <Text size="sm"><strong>Scenarios:</strong> {scenarios.length}</Text>
            </Stack>
            <Text size="xs" c="dimmed">
              This will publish the current project as a bundle to the registry. Anyone with access to this server can download and install it.
            </Text>
            {error && <Alert color="red">{error}</Alert>}
            <Group justify="flex-end">
              <Button variant="default" onClick={handleClose}>Cancel</Button>
              <Button
                leftSection={<IconCloudUpload size={16} />}
                loading={publishing}
                onClick={handlePublish}
              >
                Publish
              </Button>
            </Group>
          </>
        )}
      </Stack>
    </Modal>
  )
}
