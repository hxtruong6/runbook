import { useRef, useState } from 'react'
import { isInferenceEnabled, setInferenceEnabled } from '../inference/inferenceStore'
import type { Scenario } from '../scenarios/types'
import { downloadScenario, readScenarioFile } from '../scenarios/exportImport'
import { EnvSwitcher } from './EnvSwitcher'
import { EnvEditorModal } from './EnvEditorModal'
import { Logo } from './Logo'
import { UserMenu } from './UserMenu'
import { ActionIcon, Badge, Button, Divider, Group, Menu, Select, Title, Tooltip } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconBell, IconBolt, IconCode, IconDots, IconLayoutSidebar, IconLayoutSidebarRight, IconSettings, IconTerminal2 } from '@tabler/icons-react'
import { useTeamStore } from '../teams/teamStore'
import { CLIGuideModal } from './CLIGuideModal'
import { TeamSettingsModal } from '../teams/TeamSettingsModal'

type Props = {
  active: Scenario | null
  onRunAll: () => void
  onImport: (s: Scenario) => void
  onDuplicate?: (s: Scenario) => void
  onToggleReusable?: () => void
  onBurst?: () => void
  onWhatsNew?: () => void
  onEmbedBadge?: () => void
  onToggleNavbar?: () => void
  onToggleAside?: () => void
  navbarCollapsed?: boolean
  asideCollapsed?: boolean
}

export function TopBar({ active, onRunAll, onImport, onDuplicate, onToggleReusable, onBurst, onWhatsNew, onEmbedBadge, onToggleNavbar, onToggleAside, navbarCollapsed, asideCollapsed }: Props) {
  const [editorOpen, setEditorOpen] = useState(false)
  const [cliGuideOpen, setCliGuideOpen] = useState(false)
  const [teamSettingsOpen, setTeamSettingsOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { teams, activeTeamId, setActiveTeam, currentUserRole } = useTeamStore()

  async function handleScenarioImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const s = await readScenarioFile(file)
      onImport({ ...s, id: crypto.randomUUID(), createdAt: new Date().toISOString() })
    } catch (err) {
      notifications.show({ color: 'red', title: 'Invalid scenario file', message: (err as Error).message })
    }
    e.target.value = ''
  }

  return (
    <>
      <Group justify="space-between" h="100%" px="md">
        <Group gap="sm" align="center" wrap="nowrap">
          <Tooltip label={navbarCollapsed ? 'Show sidebar' : 'Hide sidebar'} withinPortal>
            <ActionIcon variant="subtle" size="lg" aria-label="Toggle sidebar" onClick={onToggleNavbar}>
              <IconLayoutSidebar size={18} />
            </ActionIcon>
          </Tooltip>
          <Logo size={26} />
          <Divider orientation="vertical" />
          {teams.length > 1 && (
            <Select
              size="xs"
              data={teams.map((t) => ({ value: t._id, label: t.name }))}
              value={activeTeamId}
              onChange={(v) => v && setActiveTeam(v)}
              w={140}
              comboboxProps={{ withinPortal: true }}
            />
          )}
          {activeTeamId && currentUserRole && (
            <Badge size="xs" color={currentUserRole === 'owner' ? 'violet' : currentUserRole === 'admin' ? 'teal' : 'gray'}>
              {currentUserRole}
            </Badge>
          )}
          {activeTeamId && (
            <Tooltip label="Team settings" withinPortal>
              <ActionIcon variant="subtle" size="lg" aria-label="Team settings" onClick={() => setTeamSettingsOpen(true)}>
                <IconSettings size={18} />
              </ActionIcon>
            </Tooltip>
          )}
          <EnvSwitcher onOpenEditor={() => setEditorOpen(true)} />
        </Group>

        <Group gap="xs" align="center">
          <Title order={5}>{active?.name ?? 'No scenario'}</Title>
          {active?.reusable === true && (
            <Badge size="xs" variant="light" color="violet">ref</Badge>
          )}
        </Group>

        <Group gap="xs">
          <Button variant="filled" disabled={!active} onClick={onRunAll} size="sm">
            Run all
          </Button>
          <Menu position="bottom-end" withinPortal>
            <Menu.Target>
              <ActionIcon variant="subtle" size="lg" aria-label="More actions"><IconDots size={18} /></ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item leftSection={<IconBolt size={14} />} disabled={!active} onClick={onBurst}>Burst…</Menu.Item>
              <Menu.Item onClick={() => fileInputRef.current?.click()}>Import scenario</Menu.Item>
              <Menu.Item onClick={() => active && downloadScenario(active)} disabled={!active}>Export scenario</Menu.Item>
              <Menu.Item
                onClick={() => active && onDuplicate?.({ ...active, id: crypto.randomUUID(), name: active.name + ' (copy)', createdAt: new Date().toISOString() })}
                disabled={!active}
              >
                Duplicate scenario
              </Menu.Item>
              <Menu.Item onClick={onToggleReusable} disabled={!active}>
                {active?.reusable ? 'Mark as flow' : 'Mark as reusable'}
              </Menu.Item>
              <Menu.Divider />
              <Menu.Item
                onClick={() => {
                  const next = !isInferenceEnabled()
                  setInferenceEnabled(next)
                  notifications.show({
                    color: next ? 'green' : 'gray',
                    message: `Schema inference ${next ? 'enabled' : 'disabled'}`,
                  })
                }}
              >
                {isInferenceEnabled() ? 'Disable' : 'Enable'} schema inference
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
          <Tooltip label="Embed badge" withinPortal>
            <ActionIcon variant="subtle" size="lg" aria-label="Embed badge" onClick={onEmbedBadge}>
              <IconCode size={18} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="What's new" withinPortal>
            <ActionIcon variant="subtle" size="lg" aria-label="What's new" onClick={onWhatsNew}>
              <IconBell size={18} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="CLI guide" withinPortal>
            <ActionIcon variant="subtle" size="lg" aria-label="CLI guide" onClick={() => setCliGuideOpen(true)}>
              <IconTerminal2 size={18} />
            </ActionIcon>
          </Tooltip>
          <UserMenu />
          <Tooltip label={asideCollapsed ? 'Show panel' : 'Hide panel'} withinPortal>
            <ActionIcon variant="subtle" size="lg" aria-label="Toggle panel" onClick={onToggleAside}>
              <IconLayoutSidebarRight size={18} />
            </ActionIcon>
          </Tooltip>
          <input ref={fileInputRef} type="file" accept="application/json" hidden onChange={handleScenarioImport} />
        </Group>
      </Group>
      <EnvEditorModal opened={editorOpen} onClose={() => setEditorOpen(false)} />
      <CLIGuideModal opened={cliGuideOpen} onClose={() => setCliGuideOpen(false)} />
      <TeamSettingsModal opened={teamSettingsOpen} onClose={() => setTeamSettingsOpen(false)} />
    </>
  )
}
