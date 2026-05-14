import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Alert, Button, Paper, PasswordInput, Stack,
  Tabs, Text, TextInput,
} from '@mantine/core'
import { useAuthStore } from './authStore'
import { Logo } from '../components/Logo'

export function LoginPage() {
  const { login, register, loading, error, clearError } = useAuthStore()
  const [tab, setTab] = useState<string | null>('login')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (tab === 'login') {
      await login(email, password)
    } else {
      await register(email, name, password)
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
            <Text size="sm" c="dimmed">API testing for your team</Text>
          </Stack>
          <Tabs value={tab} onChange={(v) => { setTab(v); clearError() }}>
            <Tabs.List grow>
              <Tabs.Tab value="login">Sign in</Tabs.Tab>
              <Tabs.Tab value="register">Create account</Tabs.Tab>
            </Tabs.List>
          </Tabs>
          <form onSubmit={handleSubmit}>
            <Stack gap="sm">
              {error && <Alert color="red">{error}</Alert>}
              <TextInput
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.currentTarget.value)}
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
              <PasswordInput
                label="Password"
                value={password}
                onChange={(e) => setPassword(e.currentTarget.value)}
                required
              />
              <Button type="submit" loading={loading} fullWidth mt="xs">
                {tab === 'login' ? 'Sign in' : 'Create account'}
              </Button>
            </Stack>
          </form>
        </Stack>
      </Paper>
      </motion.div>
    </div>
  )
}
