import {
  Badge,
  Box,
  Code,
  Divider,
  Group,
  Modal,
  Stack,
  Tabs,
  Text,
  ThemeIcon,
  Timeline,
  Title,
} from '@mantine/core'
import {
  IconArrowRight,
  IconBuildingCommunity,
  IconCheck,
  IconCloudUpload,
  IconDownload,
  IconKey,
  IconLayersLinked,
  IconLogin,
  IconTerminal2,
  IconUser,
} from '@tabler/icons-react'

type Props = {
  opened: boolean
  onClose: () => void
}

function Cmd({ children }: { children: string }) {
  return (
    <Code block style={{ fontSize: 13 }}>
      {children}
    </Code>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Stack gap="xs">
      <Text fw={600} size="sm" c="dimmed" tt="uppercase" style={{ letterSpacing: '0.05em' }}>
        {title}
      </Text>
      {children}
    </Stack>
  )
}

function QuickStart() {
  return (
    <Stack gap="xl">
      <Box>
        <Text size="sm" c="dimmed" mb="md">
          The Runbook CLI lets you publish and install workflow bundles from your terminal — perfect
          for CI/CD pipelines and team automation.
        </Text>

        {/* Workflow diagram */}
        <Box
          p="md"
          style={(theme) => ({
            background: theme.colors.gray[0],
            borderRadius: theme.radius.md,
            border: `1px solid ${theme.colors.gray[2]}`,
          })}
        >
          <Group justify="center" gap={0} wrap="nowrap" align="center">
            {[
              { icon: IconLogin, label: 'Login', color: 'indigo', cmd: 'runbook login' },
              { icon: IconUser, label: 'Verify', color: 'teal', cmd: 'runbook whoami' },
              { icon: IconCloudUpload, label: 'Publish', color: 'sky', cmd: 'runbook publish' },
              { icon: IconDownload, label: 'Install', color: 'sage', cmd: 'runbook install' },
            ].map((step, i, arr) => (
              <>
                <Stack key={step.cmd} align="center" gap={6} style={{ minWidth: 90 }}>
                  <ThemeIcon size="xl" radius="xl" color={step.color} variant="light">
                    <step.icon size={20} />
                  </ThemeIcon>
                  <Text size="xs" fw={600}>
                    {step.label}
                  </Text>
                  <Code style={{ fontSize: 10 }}>{step.cmd}</Code>
                </Stack>
                {i < arr.length - 1 && (
                  <Box key={`arrow-${i}`} mx={4} c="dimmed">
                    <IconArrowRight size={16} />
                  </Box>
                )}
              </>
            ))}
          </Group>
        </Box>
      </Box>

      <Timeline active={4} bulletSize={28} lineWidth={2}>
        <Timeline.Item
          bullet={<IconTerminal2 size={14} />}
          title="Install the CLI"
        >
          <Text size="xs" c="dimmed" mb={6}>
            Build from source in the monorepo, then link globally.
          </Text>
          <Cmd>{`cd packages/cli\npnpm build\nnpm link`}</Cmd>
        </Timeline.Item>

        <Timeline.Item bullet={<IconLogin size={14} />} title="Log in">
          <Text size="xs" c="dimmed" mb={6}>
            Interactive prompts for server URL, email, and password. Credentials are saved to
            <Code>~/.config/runbook/config.json</Code>.
          </Text>
          <Cmd>{`runbook login\n# → Server URL: http://localhost:3001\n# → Email:      you@example.com\n# → Password:   ••••••••\n# ✓ Logged in as you@example.com`}</Cmd>
        </Timeline.Item>

        <Timeline.Item bullet={<IconUser size={14} />} title="Verify your identity">
          <Text size="xs" c="dimmed" mb={6}>
            Confirms your active profile without making a network request.
          </Text>
          <Cmd>{`runbook whoami\n# Server : http://localhost:3001\n# Email  : you@example.com\n# Team   : none\n# Token  : eyJhbG…f3Kx`}</Cmd>
        </Timeline.Item>

        <Timeline.Item bullet={<IconCloudUpload size={14} />} title="Publish a bundle">
          <Text size="xs" c="dimmed" mb={6}>
            Uploads a <Code>.bundle.json</Code> file to the registry and returns a SHA-256
            fingerprint.
          </Text>
          <Cmd>{`runbook publish my-workflow.bundle.json\n# ✓ Published\n#   Bundle ID : my-workflow\n#   Version   : 1.0.0\n#   SHA-256   : a3f9c2...`}</Cmd>
        </Timeline.Item>

        <Timeline.Item bullet={<IconDownload size={14} />} title="Install a bundle">
          <Text size="xs" c="dimmed" mb={6}>
            Downloads and verifies the SHA-256 hash before saving — tampered bundles are rejected.
          </Text>
          <Cmd>{`runbook install my-workflow\n# ✓ Installed\n#   Bundle ID : my-workflow\n#   Version   : 1.0.0\n#   SHA-256   : a3f9c2... ✓ verified\n#   Saved to  : my-workflow.bundle.json`}</Cmd>
        </Timeline.Item>
      </Timeline>
    </Stack>
  )
}

function ProfilesGuide() {
  return (
    <Stack gap="xl">
      <Text size="sm" c="dimmed">
        Profiles let you switch between multiple servers or accounts without re-entering credentials
        every time — modelled after <Code>kubectl</Code> contexts and <Code>gh auth</Code>.
      </Text>

      {/* Profile diagram */}
      <Box
        p="md"
        style={(theme) => ({
          background: theme.colors.gray[0],
          borderRadius: theme.radius.md,
          border: `1px solid ${theme.colors.gray[2]}`,
        })}
      >
        <Stack gap="xs">
          <Group gap="xs">
            <ThemeIcon size="sm" color="indigo" variant="light" radius="xl">
              <IconLayersLinked size={12} />
            </ThemeIcon>
            <Text size="xs" fw={700}>
              ~/.config/runbook/config.json
            </Text>
          </Group>
          <Divider />
          <Group gap="lg" align="flex-start">
            <Stack gap={4} style={{ flex: 1 }}>
              <Group gap={4}>
                <Badge size="xs" color="indigo">active</Badge>
                <Text size="xs" fw={600}>default</Text>
              </Group>
              <Text size="xs" c="dimmed">localhost:3001</Text>
              <Text size="xs" c="dimmed">you@example.com</Text>
            </Stack>
            <Stack gap={4} style={{ flex: 1 }}>
              <Text size="xs" fw={600} c="dimmed">work</Text>
              <Text size="xs" c="dimmed">runbook.company.com</Text>
              <Text size="xs" c="dimmed">you@company.com</Text>
            </Stack>
            <Stack gap={4} style={{ flex: 1 }}>
              <Text size="xs" fw={600} c="dimmed">staging</Text>
              <Text size="xs" c="dimmed">staging.company.com</Text>
              <Text size="xs" c="dimmed">ci@company.com</Text>
            </Stack>
          </Group>
        </Stack>
      </Box>

      <Section title="Create a named profile">
        <Cmd>{`runbook login --profile work --server https://runbook.company.com`}</Cmd>
      </Section>

      <Section title="List all profiles">
        <Cmd>{`runbook profile list\n# * default  →  localhost:3001  (you@example.com)\n#   work     →  runbook.company.com  (you@company.com)\n#   staging  →  staging.company.com  (ci@company.com)`}</Cmd>
      </Section>

      <Section title="Switch active profile">
        <Cmd>{`runbook profile use work`}</Cmd>
      </Section>

      <Section title="Use a profile for a single command">
        <Cmd>{`runbook publish bundle.json --profile staging`}</Cmd>
      </Section>

      <Section title="Team management">
        <Cmd>{`runbook team list                # list teams on server\nrunbook team use <teamId>        # set default team in profile`}</Cmd>
      </Section>
    </Stack>
  )
}

function CICDGuide() {
  return (
    <Stack gap="xl">
      <Text size="sm" c="dimmed">
        In CI/CD pipelines you don't want a config file — use environment variables instead. Env
        vars override the active profile but are themselves overridden by explicit CLI flags.
      </Text>

      {/* Priority diagram */}
      <Box
        p="md"
        style={(theme) => ({
          background: theme.colors.gray[0],
          borderRadius: theme.radius.md,
          border: `1px solid ${theme.colors.gray[2]}`,
        })}
      >
        <Stack gap={6}>
          <Text size="xs" fw={700} c="dimmed" tt="uppercase">
            Override priority (highest → lowest)
          </Text>
          {[
            { label: 'CLI flags', example: '--server <url> --token <jwt>', color: 'indigo' },
            { label: 'Env vars', example: 'RUNBOOK_SERVER  RUNBOOK_TOKEN  RUNBOOK_TEAM', color: 'teal' },
            { label: 'Active profile', example: '~/.config/runbook/config.json', color: 'sky' },
          ].map((row, i) => (
            <Group key={i} gap="xs" align="center">
              <Badge size="sm" color={row.color} variant="light" style={{ minWidth: 90 }}>
                {row.label}
              </Badge>
              <IconArrowRight size={12} />
              <Code style={{ fontSize: 11 }}>{row.example}</Code>
            </Group>
          ))}
        </Stack>
      </Box>

      <Section title="GitHub Actions example">
        <Cmd>{`- name: Publish bundle\n  env:\n    RUNBOOK_SERVER: https://runbook.company.com\n    RUNBOOK_TOKEN: \${{ secrets.RUNBOOK_TOKEN }}\n  run: runbook publish dist/workflow.bundle.json`}</Cmd>
      </Section>

      <Section title="Available env vars">
        <Stack gap={4}>
          {[
            ['RUNBOOK_SERVER', 'Override server URL'],
            ['RUNBOOK_TOKEN', 'Override auth token (skip login)'],
            ['RUNBOOK_TEAM', 'Override team ID'],
            ['RUNBOOK_PROFILE', 'Choose which profile to use'],
          ].map(([name, desc]) => (
            <Group key={name} gap="sm" align="flex-start">
              <Code style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{name}</Code>
              <Text size="xs" c="dimmed">
                {desc}
              </Text>
            </Group>
          ))}
        </Stack>
      </Section>

      <Section title="Get your token from the web UI">
        <Text size="sm" c="dimmed">
          Click the <ThemeIcon size="xs" variant="subtle" color="gray" display="inline-flex"><IconUser size={12} /></ThemeIcon>{' '}
          user icon in the top-right → <strong>Copy token</strong>. Paste it into your CI secret as{' '}
          <Code>RUNBOOK_TOKEN</Code>.
        </Text>
      </Section>

      <Divider />

      <Group gap="xs">
        <IconCheck size={14} color="var(--mantine-color-green-6)" />
        <Text size="xs" c="dimmed">
          Full reference in <Code>packages/cli/README.md</Code> inside the monorepo.
        </Text>
      </Group>
    </Stack>
  )
}

export function CLIGuideModal({ opened, onClose }: Props) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="sm">
          <ThemeIcon size="md" color="indigo" variant="light" radius="md">
            <IconTerminal2 size={16} />
          </ThemeIcon>
          <div>
            <Title order={5} lh={1.2}>CLI Guide</Title>
            <Text size="xs" c="dimmed">Publish and install bundles from your terminal</Text>
          </div>
        </Group>
      }
      size="lg"
    >
      <Tabs defaultValue="quickstart" keepMounted={false}>
        <Tabs.List mb="md">
          <Tabs.Tab value="quickstart" leftSection={<IconTerminal2 size={14} />}>
            Quick start
          </Tabs.Tab>
          <Tabs.Tab value="profiles" leftSection={<IconKey size={14} />}>
            Profiles
          </Tabs.Tab>
          <Tabs.Tab value="cicd" leftSection={<IconBuildingCommunity size={14} />}>
            CI / CD
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="quickstart">
          <QuickStart />
        </Tabs.Panel>
        <Tabs.Panel value="profiles">
          <ProfilesGuide />
        </Tabs.Panel>
        <Tabs.Panel value="cicd">
          <CICDGuide />
        </Tabs.Panel>
      </Tabs>
    </Modal>
  )
}
