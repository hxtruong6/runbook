import { useRef } from 'react'
import { Alert, Button, Group, Select, Skeleton, Stack, Text } from '@mantine/core'
import { openConfirmModal } from '@mantine/modals'
import { notifications } from '@mantine/notifications'
import { useProjectsStore } from '../projects/projectsStore'
import { useTeamStore } from '../teams/teamStore'

export function ProjectSwitcher() {
  const { projects, activeProjectId, setActiveProject, deleteProject, importBundle, loading, importing, importErrors, error } =
    useProjectsStore()
  const { activeTeamId } = useTeamStore()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const options = projects.map((p) => ({ value: p._id, label: p.name }))

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !activeTeamId) return
    await importBundle(file, activeTeamId)
    if (useProjectsStore.getState().importErrors.length === 0 && !useProjectsStore.getState().error) {
      notifications.show({ color: 'green', message: 'Bundle imported' })
    }
    e.target.value = ''
  }

  function handleDelete() {
    const project = projects.find((p) => p._id === activeProjectId)
    if (!project || !activeTeamId) return
    openConfirmModal({
      title: 'Delete project',
      children: <Text size="sm">Delete &ldquo;{project.name}&rdquo; and all its scenarios?</Text>,
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: () => deleteProject(activeTeamId, project._id),
    })
  }

  return (
    <Stack gap={6}>
      <Text size="xs" tt="uppercase" c="dimmed" fw={600}>Project</Text>

      {loading ? (
        <Skeleton height={32} />
      ) : (
        <Select
          size="xs"
          data={options}
          value={activeProjectId}
          onChange={(val) => setActiveProject(val)}
          placeholder={options.length === 0 ? 'No projects — import one' : 'Select project'}
          disabled={options.length === 0}
          comboboxProps={{ withinPortal: true }}
          styles={{ input: { fontWeight: 500 } }}
        />
      )}

      {error && <Alert color="red">{error}</Alert>}
      {importErrors.length > 0 && (
        <Alert color="red" title="Import errors">
          {importErrors.map((e, i) => <Text key={i} size="xs">{e}</Text>)}
        </Alert>
      )}

      <Group gap="xs">
        <Button size="xs" variant="default" loading={importing} onClick={() => fileInputRef.current?.click()}>
          Import bundle
        </Button>
        <Button size="xs" variant="subtle" color="red" disabled={!activeProjectId} onClick={handleDelete}>
          Delete
        </Button>
      </Group>

      <input ref={fileInputRef} type="file" accept="application/json" hidden onChange={handleImport} />
    </Stack>
  )
}
