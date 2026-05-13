import { useState } from 'react'
import { Alert, Button, Modal, Stack, Text, TextInput } from '@mantine/core'
import { useTeamStore } from './teamStore'

export function CreateTeamModal() {
  const { needsTeam, createTeam, loading, error } = useTeamStore()
  const [name, setName] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (name.trim()) await createTeam(name.trim())
  }

  return (
    <Modal opened={needsTeam} onClose={() => {}} title="Create your first team" withCloseButton={false}>
      <form onSubmit={handleSubmit}>
        <Stack gap="sm">
          <Text size="sm" c="dimmed">
            Teams group your projects and scenarios. You can invite colleagues later.
          </Text>
          {error && <Alert color="red">{error}</Alert>}
          <TextInput
            label="Team name"
            placeholder="e.g. 32CO"
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
            required
            data-autofocus
          />
          <Button type="submit" loading={loading} fullWidth>
            Create team
          </Button>
        </Stack>
      </form>
    </Modal>
  )
}
