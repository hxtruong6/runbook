import { useState } from 'react'
import { motion } from 'framer-motion'
import { Alert, Button, Paper, PasswordInput, Stack, Text } from '@mantine/core'
import { IconAlertCircle, IconCheck } from '@tabler/icons-react'
import { useAuthStore } from './authStore'
import { Logo } from '../components/Logo'

type Props = { token: string }

export function ResetPasswordPage({ token }: Props) {
  const { resetPassword, loading } = useAuthStore()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }
    try {
      await resetPassword(token, password)
      setDone(true)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <div className="login-bg">
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.2, 0, 0, 1] }}
        style={{ position: 'relative', zIndex: 1 }}
      >
        <Paper w={400} p="xl">
          <Stack gap="lg">
            <Stack gap={6} align="center" pb="xs">
              <Logo size={44} />
              <Text size="sm" c="dimmed">Reset your password</Text>
            </Stack>
            {done ? (
              <Stack align="center" gap="md">
                <IconCheck size={40} color="var(--mantine-color-green-6)" />
                <Text fw={600} ta="center">Password updated!</Text>
                <Text size="sm" c="dimmed" ta="center">
                  Your password has been changed. You can now sign in.
                </Text>
                <Button
                  fullWidth
                  onClick={() => { window.location.hash = '/' }}
                >
                  Go to sign in
                </Button>
              </Stack>
            ) : (
              <form onSubmit={handleSubmit}>
                <Stack gap="sm">
                  {error && (
                    <Alert color="red" icon={<IconAlertCircle size={16} />}>
                      {error}
                    </Alert>
                  )}
                  <PasswordInput
                    label="New password"
                    description="At least 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.currentTarget.value)}
                    required
                  />
                  <PasswordInput
                    label="Confirm password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.currentTarget.value)}
                    required
                  />
                  <Button type="submit" loading={loading} fullWidth mt="xs">
                    Set new password
                  </Button>
                </Stack>
              </form>
            )}
          </Stack>
        </Paper>
      </motion.div>
    </div>
  )
}
