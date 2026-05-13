import { useState } from 'react'
import {
  Alert, Button, Center, Paper, PasswordInput, Stack,
  Tabs, TextInput, Title,
} from '@mantine/core'
import { useAuthStore } from './authStore'

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
    <Center h="100vh">
      <Paper w={380} p="xl">
        <Stack gap="md">
          <Title order={3}>Runbook</Title>
          <Tabs value={tab} onChange={(v) => { setTab(v); clearError() }}>
            <Tabs.List>
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
    </Center>
  )
}
