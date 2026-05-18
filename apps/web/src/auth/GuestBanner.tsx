import { useState } from 'react'
import { ActionIcon, Anchor, Group, Text } from '@mantine/core'
import { IconX } from '@tabler/icons-react'
import { useAuthStore } from './authStore'

export function GuestBanner() {
  const logout = useAuthStore((s) => s.logout)
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  return (
    <Group
      px="md"
      py={6}
      justify="center"
      style={{
        background: 'var(--mantine-color-amber-6)',
        position: 'relative',
      }}
    >
      <Text size="sm" fw={500}>
        Guest mode — your data is saved locally only.{' '}
        <Anchor fw={700} c="dark" underline="always" onClick={logout}>
          Create a free account
        </Anchor>{' '}
        to sync across devices.
      </Text>
      <ActionIcon
        variant="subtle"
        color="dark"
        size="sm"
        aria-label="Dismiss guest banner"
        style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)' }}
        onClick={() => setDismissed(true)}
      >
        <IconX size={14} />
      </ActionIcon>
    </Group>
  )
}
