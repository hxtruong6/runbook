import { useState } from 'react'
import { Alert, Button, Modal, Stack, Text, TextInput } from '@mantine/core'
import { IconAlertCircle, IconMailCheck } from '@tabler/icons-react'
import { useAuthStore } from './authStore'

type Props = { opened: boolean; onClose: () => void }

export function ForgotPasswordModal({ opened, onClose }: Props) {
  const { forgotPassword, loading } = useAuthStore()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleClose() {
    setEmail('')
    setSent(false)
    setError(null)
    onClose()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await forgotPassword(email)
      setSent(true)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <Modal opened={opened} onClose={handleClose} title="Reset your password">
      {sent ? (
        <Stack align="center" gap="md" py="md">
          <IconMailCheck size={48} color="var(--mantine-color-teal-6)" />
          <Stack gap={4} align="center">
            <Text fw={600}>Check your inbox</Text>
            <Text size="sm" c="dimmed" ta="center">
              If <strong>{email}</strong> is registered, you'll receive a reset link shortly.
            </Text>
          </Stack>
          <Button variant="light" onClick={handleClose} fullWidth>
            Done
          </Button>
        </Stack>
      ) : (
        <form onSubmit={handleSubmit}>
          <Stack gap="sm">
            <Text size="sm" c="dimmed">
              Enter your account email and we'll send you a link to reset your password.
            </Text>
            {error && (
              <Alert color="coral" icon={<IconAlertCircle size={16} />}>
                {error}
              </Alert>
            )}
            <TextInput
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.currentTarget.value)}
              required
              autoFocus
            />
            <Button type="submit" loading={loading} fullWidth mt="xs">
              Send reset link
            </Button>
          </Stack>
        </form>
      )}
    </Modal>
  )
}
