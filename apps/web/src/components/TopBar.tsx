import { useRef, useState } from 'react'
import type { Scenario } from '../scenarios/types'
import { downloadScenario, readScenarioFile } from '../scenarios/exportImport'
import { EnvSwitcher } from './EnvSwitcher'
import { EnvEditorModal } from './EnvEditorModal'
import { Logo } from './Logo'
import { UserMenu } from './UserMenu'
import { ActionIcon, Badge, Button, Divider, Group, Menu, Select, Title } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconBolt, IconDots } from '@tabler/icons-react'
import { useTeamStore } from '../teams/teamStore'

type Props = {
  active: Scenario | null
  onRunAll: () => void
  onImport: (s: Scenario) => void
  onDuplicate?: (s: Scenario) => void
  onToggleReusable?: () => void
  onBurst?: () => void
}

export function TopBar({ active, onRunAll, onImport, onDuplicate, onToggleReusable, onBurst }: Props) {
  const [editorOpen, setEditorOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { teams, activeTeamId, setActiveTeam } = useTeamStore()

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
            </Menu.Dropdown>
          </Menu>
          <UserMenu />
          <input ref={fileInputRef} type="file" accept="application/json" hidden onChange={handleScenarioImport} />
        </Group>
      </Group>
      <EnvEditorModal opened={editorOpen} onClose={() => setEditorOpen(false)} />
    </>
  )
}
