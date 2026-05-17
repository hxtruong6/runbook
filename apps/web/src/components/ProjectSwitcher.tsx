// apps/web/src/components/ProjectSwitcher.tsx
import { useRef, useState } from 'react'
import { ActionIcon, Alert, Button, Group, Menu, Select, Skeleton, Stack, Text, TextInput } from '@mantine/core'
import {
  IconApi,
  IconBrandGithub,
  IconCloudDownload,
  IconDots,
  IconDownload,
  IconFileCode,
  IconPackage,
  IconPlus,
  IconTrash,
  IconUpload,
} from '@tabler/icons-react'
import { openConfirmModal, modals } from '@mantine/modals'
import { notifications } from '@mantine/notifications'
import { useProjectsStore } from '../projects/projectsStore'
import { useTeamStore } from '../teams/teamStore'
import { PublishBundleModal } from './PublishBundleModal'
import { ImportFromRegistryModal } from './ImportFromRegistryModal'
import { OpenApiImport } from '../features/import/OpenApiImport'
import { PostmanImport } from '../features/import/PostmanImport'
import { GithubImportModal } from '../features/import/GithubImport'
import type { ProjectBundle } from '../projects/types'

export function ProjectSwitcher() {
  const { projects, activeProjectId, setActiveProject, deleteProject, createProject, importBundle, importBundleObject, loading, importing, importErrors, error } =
    useProjectsStore()
  const { activeTeamId } = useTeamStore()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [publishOpen, setPublishOpen] = useState(false)
  const [registryOpen, setRegistryOpen] = useState(false)
  const [openApiOpen, setOpenApiOpen] = useState(false)
  const [postmanOpen, setPostmanOpen] = useState(false)
  const [githubOpen, setGithubOpen] = useState(false)

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

  async function handlePostmanImport(bundle: ProjectBundle) {
    if (!activeTeamId) return
    await importBundleObject(bundle, activeTeamId)
    if (useProjectsStore.getState().importErrors.length === 0 && !useProjectsStore.getState().error) {
      notifications.show({ color: 'green', message: 'Postman collection imported' })
    }
  }

  async function handleGithubImport(bundle: ProjectBundle) {
    if (!activeTeamId) return
    await importBundleObject(bundle, activeTeamId)
    if (useProjectsStore.getState().importErrors.length === 0 && !useProjectsStore.getState().error) {
      notifications.show({ color: 'green', message: 'Bundle imported from GitHub' })
    }
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

  function handleNewProject() {
    if (!activeTeamId) return
    let name = ''
    modals.open({
      title: 'New project',
      children: (
        <form
          onSubmit={async (e) => {
            e.preventDefault()
            const trimmed = name.trim()
            if (!trimmed) return
            try {
              await createProject(activeTeamId, trimmed)
              modals.closeAll()
            } catch {
              notifications.show({ color: 'red', message: 'Failed to create project' })
            }
          }}
        >
          <TextInput
            placeholder="Project name"
            onChange={(ev) => { name = ev.currentTarget.value }}
            data-autofocus
            mb="sm"
          />
          <Button type="submit" size="sm" fullWidth>Create</Button>
        </form>
      ),
    })
  }

  return (
    <>
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
            placeholder={options.length === 0 ? 'No projects yet' : 'Select project'}
            disabled={options.length === 0}
            comboboxProps={{ withinPortal: true }}
            styles={{ input: { fontWeight: 500 } }}
          />
        )}

        {error && <Alert color="red" variant="light">{error}</Alert>}
        {importErrors.length > 0 && (
          <Alert color="red" title="Import errors">
            {importErrors.map((e, i) => <Text key={i} size="xs">{e}</Text>)}
          </Alert>
        )}

        <Group gap="xs" wrap="nowrap">
          {/* Natural-width buttons — the narrow sidebar can't fit both
              "New project" and "Import" if they share width equally
              (the Import label truncates to "Impc"). */}
          <Button
            size="xs"
            variant="default"
            leftSection={<IconPlus size={14} />}
            disabled={!activeTeamId}
            onClick={handleNewProject}
          >
            New
          </Button>

          <Menu shadow="md" position="bottom-end" width={220}>
            <Menu.Target>
              <Button
                size="xs"
                variant="default"
                leftSection={<IconDownload size={14} />}
                disabled={!activeTeamId}
              >
                Import
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Label>Import into this team</Menu.Label>
              <Menu.Item
                leftSection={<IconPackage size={14} />}
                onClick={() => fileInputRef.current?.click()}
                disabled={importing}
              >
                Bundle file (.json)
              </Menu.Item>
              <Menu.Item
                leftSection={<IconCloudDownload size={14} />}
                onClick={() => setRegistryOpen(true)}
              >
                From Registry
              </Menu.Item>
              <Menu.Item
                leftSection={<IconFileCode size={14} />}
                onClick={() => setOpenApiOpen(true)}
              >
                OpenAPI spec
              </Menu.Item>
              <Menu.Item
                leftSection={<IconApi size={14} />}
                onClick={() => setPostmanOpen(true)}
              >
                Postman collection
              </Menu.Item>
              <Menu.Item
                leftSection={<IconBrandGithub size={14} />}
                onClick={() => setGithubOpen(true)}
              >
                GitHub repo
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>

          <Menu shadow="md" position="bottom-end">
            <Menu.Target>
              <ActionIcon
                size="lg"
                variant="subtle"
                aria-label="Project actions"
                disabled={!activeProjectId}
              >
                <IconDots size={16} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item
                leftSection={<IconUpload size={14} />}
                onClick={() => setPublishOpen(true)}
              >
                Publish bundle…
              </Menu.Item>
              <Menu.Divider />
              <Menu.Item
                color="red"
                leftSection={<IconTrash size={14} />}
                onClick={handleDelete}
              >
                Delete project
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>

        <input ref={fileInputRef} type="file" accept="application/json" hidden onChange={handleImport} />
      </Stack>

      <PublishBundleModal opened={publishOpen} onClose={() => setPublishOpen(false)} />
      <ImportFromRegistryModal opened={registryOpen} onClose={() => setRegistryOpen(false)} />
      <OpenApiImport opened={openApiOpen} onClose={() => setOpenApiOpen(false)} />
      <PostmanImport
        opened={postmanOpen}
        onClose={() => setPostmanOpen(false)}
        onImport={(bundle) => { void handlePostmanImport(bundle) }}
      />
      <GithubImportModal opened={githubOpen} onClose={() => setGithubOpen(false)} onImport={(b) => void handleGithubImport(b)} />
    </>
  )
}
