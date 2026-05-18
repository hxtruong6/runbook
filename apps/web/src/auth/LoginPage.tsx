import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Alert, Anchor, Button, Paper, PasswordInput,
  Stack, Tabs, Text, TextInput,
} from '@mantine/core'
import { IconAlertCircle } from '@tabler/icons-react'
import { useAuthStore } from './authStore'
import { Logo } from '../components/Logo'
import { ForgotPasswordModal } from './ForgotPasswordModal'

function emailValid(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
}

export function LoginPage() {
  const { login, register, loginAsGuest, loading, error, clearError } = useAuthStore()
  const [tab, setTab] = useState<string | null>('login')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [emailTouched, setEmailTouched] = useState(false)
  const [passwordTouched, setPasswordTouched] = useState(false)
  const [forgotOpen, setForgotOpen] = useState(false)

  function switchTab(v: string | null) {
    setTab(v)
    setEmail('')
    setName('')
    setPassword('')
    setEmailTouched(false)
    setPasswordTouched(false)
    clearError()
  }

  const emailError = emailTouched && !emailValid(email) ? 'Enter a valid email' : null
  const passwordError =
    passwordTouched && tab === 'register' && password.length > 0 && password.length < 8
      ? 'At least 8 characters'
      : null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setEmailTouched(true)
    setPasswordTouched(true)
    if (!emailValid(email)) return
    if (tab === 'register' && password.length < 8) return
    if (tab === 'login') {
      await login(email, password)
    } else {
      await register(email, name, password)
    }
  }

  return (
    <>
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
                <Text size="sm" c="dimmed">API testing for your team</Text>
              </Stack>

              <Tabs value={tab} onChange={switchTab}>
                <Tabs.List grow>
                  <Tabs.Tab value="login">Sign in</Tabs.Tab>
                  <Tabs.Tab value="register">Create account</Tabs.Tab>
                </Tabs.List>
              </Tabs>

              <form onSubmit={handleSubmit}>
                <Stack gap="sm">
                  {error && (
                    <Alert color="red" icon={<IconAlertCircle size={16} />}>
                      {error}
                    </Alert>
                  )}

                  <TextInput
                    label="Email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.currentTarget.value)}
                    onBlur={() => setEmailTouched(true)}
                    error={emailError}
                    required
                  />

                  {tab === 'register' && (
                    <TextInput
                      label="Name"
                      value={name}
                      onChange={(e) => setName(e.currentTarget.value)}
                      required
                    />
                  )}

                  <Stack gap={4}>
                    <PasswordInput
                      label="Password"
                      value={password}
                      onChange={(e) => setPassword(e.currentTarget.value)}
                      onBlur={() => setPasswordTouched(true)}
                      error={passwordError}
                      required
                    />
                    {tab === 'login' && (
                      <Anchor
                        size="xs"
                        c="dimmed"
                        style={{ alignSelf: 'flex-end' }}
                        onClick={() => setForgotOpen(true)}
                      >
                        Forgot password?
                      </Anchor>
                    )}
                  </Stack>

                  <Button type="submit" loading={loading} fullWidth mt="xs">
                    {tab === 'login' ? 'Sign in' : 'Create account'}
                  </Button>

                  <Text size="xs" c="dimmed" ta="center">
                    <Anchor size="xs" c="dimmed" onClick={loginAsGuest}>
                      Continue as guest
                    </Anchor>
                    {' '}— data saved locally only
                  </Text>
                </Stack>
              </form>
            </Stack>
          </Paper>
        </motion.div>
      </div>

      <ForgotPasswordModal opened={forgotOpen} onClose={() => setForgotOpen(false)} />
    </>
  )
}
