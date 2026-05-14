import { useEffect, useState } from 'react'
import {
  Alert,
  Badge,
  Button,
  Group,
  Modal,
  Select,
  Skeleton,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Title,
  ActionIcon,
  Tooltip,
} from '@mantine/core'
import { openConfirmModal } from '@mantine/modals'
import { notifications } from '@mantine/notifications'
import { IconAlertCircle, IconSettings, IconTrash, IconUserPlus } from '@tabler/icons-react'
import { useTeamStore } from './teamStore'
import { useAuthStore } from '../auth/authStore'
import type { ApiMember } from '../api/teams'

type Props = {
  opened: boolean
  onClose: () => void
}

function roleBadgeColor(role: ApiMember['role']): string {
  if (role === 'owner') return 'violet'
  if (role === 'admin') return 'teal'
  return 'gray'
}

function displayMember(member: ApiMember): { primary: string; secondary: string | null } {
  return {
    primary: member.email ?? `${member.userId.slice(0, 8)}…`,
    secondary: member.name ?? null,
  }
}

export function TeamSettingsModal({ opened, onClose }: Props) {
  const {
    activeTeamId,
    members,
    membersLoading,
    membersError,
    currentUserRole,
    fetchMembers,
    inviteMember,
    removeMember,
  } = useTeamStore()

  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'admin' | 'member'>('member')
  const [inviting, setInviting] = useState(false)

  // Derive current userId from auth store token
  const token = useAuthStore((s) => s.token)
  const currentUserId: string | null = (() => {
    try {
      if (!token) return null
      const payload = token.split('.')[1]
      const decoded = JSON.parse(atob(payload)) as { sub?: string }
      return decoded.sub ?? null
    } catch {
      return null
    }
  })()

  useEffect(() => {
    if (opened && activeTeamId) {
      void fetchMembers(activeTeamId)
    }
  }, [opened, activeTeamId, fetchMembers])

  async function handleInvite() {
    if (!activeTeamId || !email.trim()) return
    setInviting(true)
    try {
      await inviteMember(activeTeamId, email.trim(), role)
      notifications.show({ color: 'green', title: 'Invitation sent', message: `${email.trim()} has been added as ${role}.` })
      setEmail('')
    } catch (e) {
      notifications.show({ color: 'red', title: 'Invite failed', message: (e as Error).message })
    } finally {
      setInviting(false)
    }
  }

  function handleRemove(member: ApiMember) {
    const { primary } = displayMember(member)
    openConfirmModal({
      title: 'Remove member',
      children: (
        <Text size="sm">
          Are you sure you want to remove <strong>{primary}</strong> from this team?
          This action cannot be undone.
        </Text>
      ),
      labels: { confirm: 'Remove', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        if (!activeTeamId) return
        try {
          await removeMember(activeTeamId, member.userId)
          notifications.show({ color: 'green', message: 'Member removed.' })
        } catch (e) {
          notifications.show({ color: 'red', title: 'Remove failed', message: (e as Error).message })
        }
      },
    })
  }

  const canInvite = currentUserRole === 'owner' || currentUserRole === 'admin'
  const canRemove = currentUserRole === 'owner'

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="sm">
          <ThemeIcon size="md" color="violet" variant="light" radius="md">
            <IconSettings size={16} />
          </ThemeIcon>
          <div>
            <Title order={5} lh={1.2}>Team Settings</Title>
            <Text size="xs" c="dimmed">Manage team members and roles</Text>
          </div>
        </Group>
      }
      size="md"
    >
      <Stack gap="md">
        {/* Member list */}
        <Stack gap="xs">
          <Text fw={600} size="sm">Members</Text>

          {membersLoading && (
            <Stack gap="xs">
              <Skeleton height={36} radius="md" />
              <Skeleton height={36} radius="md" />
              <Skeleton height={36} radius="md" />
            </Stack>
          )}

          {!membersLoading && membersError && (
            <Alert color="red" icon={<IconAlertCircle size={16} />} title="Failed to load members">
              {membersError}
              <Button
                variant="subtle"
                color="red"
                size="xs"
                mt="xs"
                onClick={() => activeTeamId && fetchMembers(activeTeamId)}
              >
                Retry
              </Button>
            </Alert>
          )}

          {!membersLoading && !membersError && members.length === 0 && (
            <Text size="sm" c="dimmed">No members found.</Text>
          )}

          {!membersLoading && !membersError && members.map((member) => {
            const { primary, secondary } = displayMember(member)
            return (
              <Group key={member.userId} justify="space-between" px="sm" py="xs"
                style={(theme) => ({
                  borderRadius: theme.radius.md,
                  border: `1px solid ${theme.colors.gray[2]}`,
                })}
              >
                <Group gap="sm">
                  <Stack gap={2}>
                    <Group gap="xs">
                      <Text size="sm">{primary}</Text>
                      {member.userId === currentUserId && (
                        <Text size="xs" c="dimmed">(you)</Text>
                      )}
                    </Group>
                    {secondary && <Text size="xs" c="dimmed">{secondary}</Text>}
                  </Stack>
                  <Badge color={roleBadgeColor(member.role)} size="sm">{member.role}</Badge>
                </Group>

                {canRemove && member.userId !== currentUserId && (
                  <Tooltip label="Remove member" withinPortal>
                    <ActionIcon
                      color="red"
                      variant="subtle"
                      size="lg"
                      aria-label={`Remove member ${primary}`}
                      onClick={() => handleRemove(member)}
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Tooltip>
                )}
              </Group>
            )
          })}
        </Stack>

        {/* Invite section */}
        {canInvite && (
          <Stack gap="xs">
            <Text fw={600} size="sm">Invite member</Text>
            <Group align="flex-end" gap="sm">
              <TextInput
                style={{ flex: 1 }}
                placeholder="colleague@example.com"
                label="Email"
                value={email}
                onChange={(e) => setEmail(e.currentTarget.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void handleInvite() }}
              />
              <Select
                label="Role"
                w={110}
                value={role}
                onChange={(v) => v && setRole(v as 'admin' | 'member')}
                data={[
                  { value: 'member', label: 'Member' },
                  { value: 'admin', label: 'Admin' },
                ]}
              />
              <Button
                leftSection={<IconUserPlus size={16} />}
                loading={inviting}
                disabled={!email.trim()}
                onClick={() => void handleInvite()}
              >
                Invite
              </Button>
            </Group>
          </Stack>
        )}
      </Stack>
    </Modal>
  )
}
