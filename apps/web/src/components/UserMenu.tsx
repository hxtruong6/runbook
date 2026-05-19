// apps/web/src/components/UserMenu.tsx
import { ActionIcon, Menu, Text, Tooltip } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconUser, IconCopy, IconLogout } from '@tabler/icons-react'
import { useAuthStore } from '../auth/authStore'

function decodeJwtEmail(token: string): string {
  try {
    const payload = token.split('.')[1]
    const decoded = JSON.parse(atob(payload)) as { email?: string }
    return decoded.email ?? ''
  } catch {
    return ''
  }
}

export function UserMenu() {
  const { token, logout } = useAuthStore()

  if (!token) return null

  const safeToken: string = token
  const email = decodeJwtEmail(safeToken)
  const tokenPreview = `${safeToken.slice(0, 6)}…${safeToken.slice(-4)}`

  async function handleCopyToken() {
    try {
      await navigator.clipboard.writeText(safeToken)
      notifications.show({ color: 'sage', message: 'Token copied to clipboard' })
    } catch {
      notifications.show({ color: 'coral', message: 'Could not copy token' })
    }
  }

  return (
    <Menu position="bottom-end" withinPortal>
      <Menu.Target>
        <Tooltip label={email || 'Account'} withinPortal>
          <ActionIcon variant="subtle" size="lg" aria-label="User menu">
            <IconUser size={18} />
          </ActionIcon>
        </Tooltip>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>{email || 'Logged in'}</Menu.Label>
        <Menu.Item
          leftSection={<IconCopy size={14} />}
          onClick={handleCopyToken}
        >
          Copy token
          <Text size="xs" c="dimmed" ml={4} component="span">{tokenPreview}</Text>
        </Menu.Item>
        <Menu.Divider />
        <Menu.Item
          color="coral"
          leftSection={<IconLogout size={14} />}
          onClick={logout}
        >
          Log out
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  )
}
