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
  IconPencil,
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
  const { projects, activeProjectId, setActiveProject, deleteProject, renameProject, createProject, importBundle, importBundleObject, loading, importing, importErrors, error } =
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
      notifications.show({ color: 'sage', message: 'Bundle imported' })
    }
    e.target.value = ''
  }

  async function handlePostmanImport(bundle: ProjectBundle) {
    if (!activeTeamId) return
    await importBundleObject(bundle, activeTeamId)
    if (useProjectsStore.getState().importErrors.length === 0 && !useProjectsStore.getState().error) {
      notifications.show({ color: 'sage', message: 'Postman collection imported' })
    }
  }

  async function handleGithubImport(bundle: ProjectBundle) {
    if (!activeTeamId) return
    await importBundleObject(bundle, activeTeamId)
    if (useProjectsStore.getState().importErrors.length === 0 && !useProjectsStore.getState().error) {
      notifications.show({ color: 'sage', message: 'Bundle imported from GitHub' })
    }
  }

  function handleDelete() {
    const project = projects.find((p) => p._id === activeProjectId)
    if (!project || !activeTeamId) return
    openConfirmModal({
      title: 'Delete project',
      children: <Text size="sm">Delete &ldquo;{project.name}&rdquo; and all its scenarios?</Text>,
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'coral' },
      onConfirm: () => deleteProject(activeTeamId, project._id),
    })
  }

  function handleRename() {
    const project = projects.find((p) => p._id === activeProjectId)
    if (!project || !activeTeamId) return
    let name = project.name
    modals.open({
      title: 'Rename project',
      children: (
        <form
          onSubmit={async (e) => {
            e.preventDefault()
            const trimmed = name.trim()
            if (!trimmed || trimmed === project.name) { modals.closeAll(); return }
            try {
              await renameProject(activeTeamId, project._id, trimmed)
              modals.closeAll()
            } catch {
              notifications.show({ color: 'coral', message: 'Failed to rename project' })
            }
          }}
        >
          <TextInput
            defaultValue={project.name}
            onChange={(ev) => { name = ev.currentTarget.value }}
            data-autofocus
            mb="sm"
          />
          <Button type="submit" size="sm" fullWidth>Rename</Button>
        </form>
      ),
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
              notifications.show({ color: 'coral', message: 'Failed to create project' })
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

        {error && <Alert color="coral" variant="light">{error}</Alert>}
        {importErrors.length > 0 && (
          <Alert color="coral" title="Import errors">
            {importErrors.map((e, i) => <Text key={i} size="xs">{e}</Text>)}
          </Alert>
        )}

        <Group gap={6} wrap="nowrap">
          {/* Compact buttons — the 240px navbar can't fit two labels +
              icons + overflow menu without truncating to "Nev" / "Impor".
              Use compact size and drop leftSection icons; the labels are
              short enough to stand on their own. */}
          <Button
            size="compact-sm"
            variant="default"
            disabled={!activeTeamId}
            onClick={handleNewProject}
            px="sm"
          >
            + New
          </Button>

          <Menu shadow="md" position="bottom-end" width={220}>
            <Menu.Target>
              <Button
                size="compact-sm"
                variant="default"
                disabled={!activeTeamId}
                px="sm"
                rightSection={<IconDownload size={12} />}
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
              <Menu.Item
                leftSection={<IconPencil size={14} />}
                onClick={handleRename}
              >
                Rename project…
              </Menu.Item>
              <Menu.Divider />
              <Menu.Item
                color="coral"
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
