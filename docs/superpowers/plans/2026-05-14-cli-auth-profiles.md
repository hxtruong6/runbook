# CLI Auth, Profiles & Multi-Team Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `runbook login/logout/whoami`, named profiles, multi-team support, and a web token-copy button so the CLI is usable without ever manually handling JWTs.

**Architecture:** A `config.ts` module owns all reads/writes to `~/.config/runbook/config.json`. Every CLI command calls `resolveServer`/`resolveToken` from that module instead of requiring raw flags. Env vars override profile values; explicit flags override env vars. The web adds a UserMenu component that decodes the stored JWT client-side to show the user's email and a Copy token button.

**Tech Stack:** Node.js `readline/promises` + `@inquirer/prompts` (password masking), Commander, React + Mantine (web), JWT base64 decode (no library).

**No commits** — write code only.

---

## File Map

**New — CLI**
- `packages/cli/src/config.ts` — profile read/write, credential resolution
- `packages/cli/src/commands/login.ts`
- `packages/cli/src/commands/logout.ts`
- `packages/cli/src/commands/whoami.ts`
- `packages/cli/src/commands/profile.ts` — `profile list` + `profile use`
- `packages/cli/src/commands/team.ts` — `team list` + `team use`
- `packages/cli/README.md`

**Modified — CLI**
- `packages/cli/package.json` — add `@inquirer/prompts` dependency
- `packages/cli/src/index.ts` — register new commands
- `packages/cli/src/commands/publish.ts` — read server/token from profile
- `packages/cli/src/commands/install.ts` — read server from profile

**New — Web**
- `apps/web/src/components/UserMenu.tsx`

**Modified — Web**
- `apps/web/src/components/TopBar.tsx` — add UserMenu to right group

---

## Task 1: Add @inquirer/prompts to CLI package

**Files:**
- Modify: `packages/cli/package.json`

- [ ] **Step 1: Add the dependency**

```bash
cd /Users/xuantruong/Documents/WORK/32CO/test-fe/packages/cli && pnpm add @inquirer/prompts
```

Expected: `@inquirer/prompts` appears in `package.json` dependencies and `node_modules`.

---

## Task 2: Config module

**Files:**
- Create: `packages/cli/src/config.ts`

- [ ] **Step 1: Create the config module**

```typescript
// packages/cli/src/config.ts
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join, dirname } from 'node:path'

export type Profile = {
  server: string
  token: string
  email: string
  teamId: string
}

type Config = {
  currentProfile: string
  profiles: Record<string, Profile>
}

const EMPTY_CONFIG: Config = { currentProfile: 'default', profiles: {} }

export function getConfigPath(): string {
  return join(homedir(), '.config', 'runbook', 'config.json')
}

export async function loadConfig(): Promise<Config> {
  try {
    const raw = await readFile(getConfigPath(), 'utf-8')
    return JSON.parse(raw) as Config
  } catch {
    return { ...EMPTY_CONFIG }
  }
}

export async function saveConfig(config: Config): Promise<void> {
  const path = getConfigPath()
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, JSON.stringify(config, null, 2), 'utf-8')
}

export async function getActiveProfile(profileName?: string): Promise<Profile> {
  const config = await loadConfig()
  const name = profileName ?? process.env['RUNBOOK_PROFILE'] ?? config.currentProfile
  const profile = config.profiles[name]
  if (!profile) {
    console.error(`Error: Profile "${name}" not found. Run: runbook login --profile ${name}`)
    process.exit(1)
  }
  return profile
}

export async function upsertProfile(name: string, updates: Partial<Profile>): Promise<void> {
  const config = await loadConfig()
  config.profiles[name] = { ...config.profiles[name], ...updates } as Profile
  await saveConfig(config)
}

export async function setCurrentProfile(name: string): Promise<void> {
  const config = await loadConfig()
  config.currentProfile = name
  await saveConfig(config)
}

export function resolveServer(opts: { server?: string }, profile: Profile): string {
  return opts.server ?? process.env['RUNBOOK_SERVER'] ?? profile.server
}

export function resolveToken(opts: { token?: string }, profile: Profile): string {
  const token = opts.token ?? process.env['RUNBOOK_TOKEN'] ?? profile.token
  if (!token) {
    console.error('Error: Not logged in. Run: runbook login')
    process.exit(1)
  }
  return token
}

export function resolveTeamId(opts: { team?: string }, profile: Profile): string {
  const teamId = opts.team ?? process.env['RUNBOOK_TEAM'] ?? profile.teamId
  if (!teamId) {
    console.error('Error: No team set. Run: runbook team use <teamId>')
    process.exit(1)
  }
  return teamId
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd /Users/xuantruong/Documents/WORK/32CO/test-fe/packages/cli && npx tsc --noEmit
```

Expected: no errors (config.ts is not yet imported by anything so only type-checks in isolation)

---

## Task 3: Login command

**Files:**
- Create: `packages/cli/src/commands/login.ts`

- [ ] **Step 1: Create the login command**

```typescript
// packages/cli/src/commands/login.ts
import { Command } from 'commander'
import { input, password } from '@inquirer/prompts'
import { loadConfig, saveConfig, getConfigPath } from '../config.js'

export const loginCommand = new Command('login')
  .description('Log in to a Runbook server and save credentials to a profile')
  .option('--server <url>', 'Server URL (skips prompt)')
  .option('--profile <name>', 'Profile name to save credentials to', 'default')
  .action(async (opts: { server?: string; profile: string }) => {
    const server = opts.server ?? await input({
      message: 'Server URL:',
      default: 'http://localhost:3001',
    })

    const email = await input({ message: 'Email:' })
    const pwd = await password({ message: 'Password:' })

    const url = `${server.replace(/\/$/, '')}/auth/login`

    let res: Response
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pwd }),
      })
    } catch (e) {
      console.error(`Error: Could not reach server at ${server}`)
      console.error((e as Error).message)
      process.exit(1)
      return
    }

    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as Record<string, unknown>
      console.error(`Error: ${body['error'] ?? res.statusText}`)
      process.exit(1)
      return
    }

    const { token } = await res.json() as { token: string }

    const config = await loadConfig()
    config.profiles[opts.profile] = { server, token, email, teamId: config.profiles[opts.profile]?.teamId ?? '' }
    config.currentProfile = opts.profile
    await saveConfig(config)

    console.log(`✓ Logged in as ${email}`)
    console.log(`  Profile : ${opts.profile}`)
    console.log(`  Server  : ${server}`)
    console.log(`  Config  : ${getConfigPath()}`)
  })
```

---

## Task 4: Logout and Whoami commands

**Files:**
- Create: `packages/cli/src/commands/logout.ts`
- Create: `packages/cli/src/commands/whoami.ts`

- [ ] **Step 1: Create logout command**

```typescript
// packages/cli/src/commands/logout.ts
import { Command } from 'commander'
import { loadConfig, saveConfig } from '../config.js'

export const logoutCommand = new Command('logout')
  .description('Clear the stored token for a profile')
  .option('--profile <name>', 'Profile name to log out of')
  .action(async (opts: { profile?: string }) => {
    const config = await loadConfig()
    const name = opts.profile ?? config.currentProfile

    if (!config.profiles[name]) {
      console.error(`Error: Profile "${name}" not found`)
      process.exit(1)
      return
    }

    config.profiles[name].token = ''
    await saveConfig(config)
    console.log(`✓ Logged out of profile "${name}"`)
  })
```

- [ ] **Step 2: Create whoami command**

```typescript
// packages/cli/src/commands/whoami.ts
import { Command } from 'commander'
import { loadConfig } from '../config.js'

export const whoamiCommand = new Command('whoami')
  .description('Show the current profile and logged-in user')
  .option('--profile <name>', 'Profile to inspect')
  .action(async (opts: { profile?: string }) => {
    const config = await loadConfig()
    const name = opts.profile ?? process.env['RUNBOOK_PROFILE'] ?? config.currentProfile
    const profile = config.profiles[name]

    if (!profile) {
      console.error(`Error: Profile "${name}" not found. Run: runbook login`)
      process.exit(1)
      return
    }

    const tokenPreview = profile.token
      ? `${profile.token.slice(0, 6)}…${profile.token.slice(-4)}`
      : '(not logged in)'

    console.log(`Profile : ${name}${name === config.currentProfile ? ' (active)' : ''}`)
    console.log(`Server  : ${profile.server}`)
    console.log(`Email   : ${profile.email || '—'}`)
    console.log(`Team    : ${profile.teamId || '(none — run: runbook team use <id>)'}`)
    console.log(`Token   : ${tokenPreview}`)
  })
```

---

## Task 5: Profile command

**Files:**
- Create: `packages/cli/src/commands/profile.ts`

- [ ] **Step 1: Create the profile command**

```typescript
// packages/cli/src/commands/profile.ts
import { Command } from 'commander'
import { loadConfig, setCurrentProfile } from '../config.js'

const profileListCommand = new Command('list')
  .description('List all saved profiles')
  .action(async () => {
    const config = await loadConfig()
    const names = Object.keys(config.profiles)

    if (names.length === 0) {
      console.log('No profiles saved. Run: runbook login')
      return
    }

    for (const name of names) {
      const p = config.profiles[name]
      const active = name === config.currentProfile ? ' *' : ''
      console.log(`${name}${active}`)
      console.log(`  Server : ${p.server}`)
      console.log(`  Email  : ${p.email || '—'}`)
      console.log(`  Team   : ${p.teamId || '—'}`)
    }
  })

const profileUseCommand = new Command('use')
  .description('Switch the active profile')
  .argument('<name>', 'Profile name to activate')
  .action(async (name: string) => {
    const config = await loadConfig()
    if (!config.profiles[name]) {
      console.error(`Error: Profile "${name}" not found`)
      console.error(`Available: ${Object.keys(config.profiles).join(', ') || '(none)'}`)
      process.exit(1)
      return
    }
    await setCurrentProfile(name)
    console.log(`✓ Switched to profile "${name}"`)
  })

export const profileCommand = new Command('profile')
  .description('Manage named profiles (multiple servers / accounts)')
  .addCommand(profileListCommand)
  .addCommand(profileUseCommand)
```

---

## Task 6: Team command

**Files:**
- Create: `packages/cli/src/commands/team.ts`

- [ ] **Step 1: Create the team command**

```typescript
// packages/cli/src/commands/team.ts
import { Command } from 'commander'
import { getActiveProfile, upsertProfile, resolveServer, resolveToken, loadConfig } from '../config.js'

const teamListCommand = new Command('list')
  .description('List teams for the current user')
  .option('--profile <name>', 'Profile to use')
  .option('--server <url>', 'Override server URL')
  .option('--token <jwt>', 'Override auth token')
  .action(async (opts: { profile?: string; server?: string; token?: string }) => {
    const profile = await getActiveProfile(opts.profile)
    const server = resolveServer(opts, profile)
    const token = resolveToken(opts, profile)

    let res: Response
    try {
      res = await fetch(`${server.replace(/\/$/, '')}/teams`, {
        headers: { Authorization: `Bearer ${token}` },
      })
    } catch (e) {
      console.error(`Error: Could not reach server at ${server}`)
      console.error((e as Error).message)
      process.exit(1)
      return
    }

    if (!res.ok) {
      console.error(`Error: Server returned ${res.status}`)
      process.exit(1)
      return
    }

    const teams = await res.json() as Array<{ _id: string; name: string }>

    if (teams.length === 0) {
      console.log('No teams found. Create one in the web UI.')
      return
    }

    const config = await loadConfig()
    const profileName = opts.profile ?? config.currentProfile

    for (const t of teams) {
      const active = t._id === profile.teamId ? ' (active)' : ''
      console.log(`${t._id}  ${t.name}${active}`)
    }
    console.log(`\nTo set a default team: runbook team use <id> --profile ${profileName}`)
  })

const teamUseCommand = new Command('use')
  .description('Set the default team for a profile')
  .argument('<teamId>', 'Team ID to set as default')
  .option('--profile <name>', 'Profile to update')
  .action(async (teamId: string, opts: { profile?: string }) => {
    const config = await loadConfig()
    const name = opts.profile ?? config.currentProfile
    await upsertProfile(name, { teamId })
    console.log(`✓ Default team set to "${teamId}" in profile "${name}"`)
  })

export const teamCommand = new Command('team')
  .description('Manage team selection per profile')
  .addCommand(teamListCommand)
  .addCommand(teamUseCommand)
```

---

## Task 7: Update publish command

**Files:**
- Modify: `packages/cli/src/commands/publish.ts`

- [ ] **Step 1: Replace publish.ts with profile-aware version**

```typescript
// packages/cli/src/commands/publish.ts
import { Command } from 'commander'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { getActiveProfile, resolveServer, resolveToken } from '../config.js'

export const publishCommand = new Command('publish')
  .description('Publish a bundle file to the Runbook registry')
  .argument('<file>', 'Path to the .bundle.json file')
  .option('--profile <name>', 'Profile to use for credentials')
  .option('--server <url>', 'Override server URL')
  .option('--token <jwt>', 'Override auth token')
  .action(async (file: string, opts: { profile?: string; server?: string; token?: string }) => {
    const profile = await getActiveProfile(opts.profile)
    const server = resolveServer(opts, profile)
    const token = resolveToken(opts, profile)

    const filePath = resolve(file)

    let rawText: string
    try {
      rawText = await readFile(filePath, 'utf-8')
    } catch {
      console.error(`Error: Cannot read file "${filePath}"`)
      process.exit(1)
      return
    }

    let bundle: unknown
    try {
      bundle = JSON.parse(rawText)
    } catch {
      console.error('Error: File is not valid JSON')
      process.exit(1)
      return
    }

    const url = `${server.replace(/\/$/, '')}/registry/publish`

    let res: Response
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(bundle),
      })
    } catch (e) {
      console.error(`Error: Could not reach server at ${server}`)
      console.error((e as Error).message)
      process.exit(1)
      return
    }

    const body = await res.json() as Record<string, unknown>

    if (!res.ok) {
      console.error(`Error: Server returned ${res.status}`)
      console.error(JSON.stringify(body, null, 2))
      process.exit(1)
      return
    }

    console.log(`✓ Published`)
    console.log(`  Bundle ID  : ${body['bundleId']}`)
    console.log(`  Version    : ${body['latestVersion']}`)
    console.log(`  SHA-256    : ${body['hash']}`)
  })
```

---

## Task 8: Update install command

**Files:**
- Modify: `packages/cli/src/commands/install.ts`

- [ ] **Step 1: Replace install.ts with profile-aware version**

```typescript
// packages/cli/src/commands/install.ts
import { Command } from 'commander'
import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createHash } from 'node:crypto'
import { getActiveProfile, resolveServer } from '../config.js'

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value as object)
        .sort()
        .map((k) => [k, sortKeys((value as Record<string, unknown>)[k])])
    )
  }
  return value
}

function computeHash(bundle: unknown): string {
  return createHash('sha256').update(JSON.stringify(sortKeys(bundle))).digest('hex')
}

export const installCommand = new Command('install')
  .description('Download and verify a bundle from the Runbook registry')
  .argument('<bundleId>', 'Bundle ID to install')
  .option('--profile <name>', 'Profile to use for server URL')
  .option('--server <url>', 'Override server URL')
  .option('--output <file>', 'Output file path (default: <bundleId>.bundle.json)')
  .action(async (bundleId: string, opts: { profile?: string; server?: string; output?: string }) => {
    const profile = await getActiveProfile(opts.profile)
    const server = resolveServer(opts, profile)
    const url = `${server.replace(/\/$/, '')}/registry/${encodeURIComponent(bundleId)}`

    let res: Response
    try {
      res = await fetch(url)
    } catch (e) {
      console.error(`Error: Could not reach server at ${server}`)
      console.error((e as Error).message)
      process.exit(1)
      return
    }

    if (res.status === 404) {
      console.error(`Error: Bundle "${bundleId}" not found in registry`)
      process.exit(1)
      return
    }

    if (!res.ok) {
      console.error(`Error: Server returned ${res.status}`)
      process.exit(1)
      return
    }

    const body = await res.json() as { bundle: unknown; hash: string; bundleId: string; latestVersion: string }

    const computedHash = computeHash(body.bundle)
    if (computedHash !== body.hash) {
      console.error('Error: Hash verification failed — bundle may be corrupted or tampered with')
      console.error(`  Expected : ${body.hash}`)
      console.error(`  Got      : ${computedHash}`)
      process.exit(1)
      return
    }

    const outputPath = resolve(opts.output ?? `${bundleId}.bundle.json`)
    await writeFile(outputPath, JSON.stringify(body.bundle, null, 2), 'utf-8')

    console.log(`✓ Installed`)
    console.log(`  Bundle ID  : ${body.bundleId}`)
    console.log(`  Version    : ${body.latestVersion}`)
    console.log(`  SHA-256    : ${body.hash} ✓ verified`)
    console.log(`  Saved to   : ${outputPath}`)
  })
```

---

## Task 9: Update index.ts to register new commands

**Files:**
- Modify: `packages/cli/src/index.ts`

- [ ] **Step 1: Replace index.ts**

```typescript
#!/usr/bin/env node
// packages/cli/src/index.ts
import { Command } from 'commander'
import { publishCommand } from './commands/publish.js'
import { installCommand } from './commands/install.js'
import { loginCommand } from './commands/login.js'
import { logoutCommand } from './commands/logout.js'
import { whoamiCommand } from './commands/whoami.js'
import { profileCommand } from './commands/profile.js'
import { teamCommand } from './commands/team.js'

const program = new Command()

program
  .name('runbook')
  .description('Runbook CLI — publish and install API workflow bundles')
  .version('0.1.0')

program.addCommand(loginCommand)
program.addCommand(logoutCommand)
program.addCommand(whoamiCommand)
program.addCommand(profileCommand)
program.addCommand(teamCommand)
program.addCommand(publishCommand)
program.addCommand(installCommand)

program.parse()
```

- [ ] **Step 2: Build the CLI and verify it compiles**

```bash
cd /Users/xuantruong/Documents/WORK/32CO/test-fe/packages/cli && pnpm build
```

Expected: `dist/` updated, no TypeScript errors. Smoke test:

```bash
node dist/index.js --help
```

Expected output includes: `login`, `logout`, `whoami`, `profile`, `team`, `publish`, `install`

---

## Task 10: UserMenu web component

**Files:**
- Create: `apps/web/src/components/UserMenu.tsx`

- [ ] **Step 1: Create the UserMenu component**

```typescript
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

  const email = decodeJwtEmail(token)
  const tokenPreview = `${token.slice(0, 6)}…${token.slice(-4)}`

  async function handleCopyToken() {
    try {
      await navigator.clipboard.writeText(token)
      notifications.show({ color: 'green', message: 'Token copied to clipboard' })
    } catch {
      notifications.show({ color: 'red', message: 'Could not copy token' })
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
          color="red"
          leftSection={<IconLogout size={14} />}
          onClick={logout}
        >
          Log out
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  )
}
```

---

## Task 11: Update TopBar to include UserMenu

**Files:**
- Modify: `apps/web/src/components/TopBar.tsx`

- [ ] **Step 1: Add UserMenu import and render it in the right group**

Replace the full file:

```typescript
// apps/web/src/components/TopBar.tsx
import { useRef, useState } from 'react'
import type { Scenario } from '../scenarios/types'
import { downloadScenario, readScenarioFile } from '../scenarios/exportImport'
import { EnvSwitcher } from './EnvSwitcher'
import { EnvEditorModal } from './EnvEditorModal'
import { Logo } from './Logo'
import { UserMenu } from './UserMenu'
import { ActionIcon, Badge, Button, Divider, Group, Menu, Select, Title } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconBolt, IconDots } from '@tabler/icons-react'
import { useTeamStore } from '../teams/teamStore'

type Props = {
  active: Scenario | null
  onRunAll: () => void
  onImport: (s: Scenario) => void
  onDuplicate?: (s: Scenario) => void
  onToggleReusable?: () => void
  onBurst?: () => void
}

export function TopBar({ active, onRunAll, onImport, onDuplicate, onToggleReusable, onBurst }: Props) {
  const [editorOpen, setEditorOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { teams, activeTeamId, setActiveTeam } = useTeamStore()

  async function handleScenarioImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const s = await readScenarioFile(file)
      onImport({ ...s, id: crypto.randomUUID(), createdAt: new Date().toISOString() })
    } catch (err) {
      notifications.show({ color: 'red', title: 'Invalid scenario file', message: (err as Error).message })
    }
    e.target.value = ''
  }

  return (
    <>
      <Group justify="space-between" h="100%" px="md">
        <Group gap="sm" align="center" wrap="nowrap">
          <Logo size={26} />
          <Divider orientation="vertical" />
          {teams.length > 1 && (
            <Select
              size="xs"
              data={teams.map((t) => ({ value: t._id, label: t.name }))}
              value={activeTeamId}
              onChange={(v) => v && setActiveTeam(v)}
              w={140}
              comboboxProps={{ withinPortal: true }}
            />
          )}
          <EnvSwitcher onOpenEditor={() => setEditorOpen(true)} />
        </Group>

        <Group gap="xs" align="center">
          <Title order={5}>{active?.name ?? 'No scenario'}</Title>
          {active?.reusable === true && (
            <Badge size="xs" variant="light" color="violet">ref</Badge>
          )}
        </Group>

        <Group gap="xs">
          <Button variant="filled" disabled={!active} onClick={onRunAll} size="sm">
            Run all
          </Button>
          <Menu position="bottom-end" withinPortal>
            <Menu.Target>
              <ActionIcon variant="subtle" size="lg" aria-label="More actions"><IconDots size={18} /></ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item leftSection={<IconBolt size={14} />} disabled={!active} onClick={onBurst}>Burst…</Menu.Item>
              <Menu.Item onClick={() => fileInputRef.current?.click()}>Import scenario</Menu.Item>
              <Menu.Item onClick={() => active && downloadScenario(active)} disabled={!active}>Export scenario</Menu.Item>
              <Menu.Item
                onClick={() => active && onDuplicate?.({ ...active, id: crypto.randomUUID(), name: active.name + ' (copy)', createdAt: new Date().toISOString() })}
                disabled={!active}
              >
                Duplicate scenario
              </Menu.Item>
              <Menu.Item onClick={onToggleReusable} disabled={!active}>
                {active?.reusable ? 'Mark as flow' : 'Mark as reusable'}
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
          <UserMenu />
          <input ref={fileInputRef} type="file" accept="application/json" hidden onChange={handleScenarioImport} />
        </Group>
      </Group>
      <EnvEditorModal opened={editorOpen} onClose={() => setEditorOpen(false)} />
    </>
  )
}
```

- [ ] **Step 2: Verify web TypeScript compiles**

```bash
cd /Users/xuantruong/Documents/WORK/32CO/test-fe/apps/web && npx tsc --noEmit
```

Expected: no new errors (the pre-existing `httpRequest.ts` error is acceptable)

---

## Task 12: CLI README

**Files:**
- Create: `packages/cli/README.md`

- [ ] **Step 1: Create the README**

```markdown
# @runbook/cli

Runbook command-line interface — publish and install API workflow bundles, manage profiles and teams.

## Installation

```bash
# From the monorepo root
pnpm --filter @runbook/cli build
# Link globally (optional)
npm link packages/cli
```

## Quick Start

```bash
# 1. Log in (creates a "default" profile)
runbook login

# 2. Set your default team
runbook team list
runbook team use <teamId>

# 3. Publish a bundle
runbook publish my-api.bundle.json

# 4. Install a bundle from the registry
runbook install my-api-bundle-id
```

## Authentication

Credentials are stored in `~/.config/runbook/config.json`.

```bash
runbook login                          # interactive, saves to "default" profile
runbook login --server https://... --profile work
runbook logout                         # clear token for active profile
runbook whoami                         # show current profile info
```

## Multiple Profiles (Multiple Servers / Accounts)

```bash
runbook profile list                   # list all profiles (* = active)
runbook profile use work               # switch active profile
```

Each profile stores its own server URL, token, and default team.

## Team Management

```bash
runbook team list                      # list teams for current user
runbook team use <teamId>              # set default team in active profile
runbook team list --profile work       # use a specific profile
```

## Publishing

```bash
runbook publish bundle.json
runbook publish bundle.json --profile work
runbook publish bundle.json --server http://localhost:3001 --token eyJ...
```

## Installing

```bash
runbook install my-bundle-id
runbook install my-bundle-id --output ./downloads/bundle.json
runbook install my-bundle-id --profile work
```

The install command verifies the SHA-256 hash of the downloaded bundle before saving.

## CI/CD — Environment Variables

Skip the config file entirely in pipelines:

```bash
export RUNBOOK_SERVER=https://registry.example.com
export RUNBOOK_TOKEN=$CI_JWT_TOKEN
export RUNBOOK_TEAM=$TEAM_ID

runbook publish dist/bundle.json
```

| Variable | Overrides |
|---|---|
| `RUNBOOK_SERVER` | profile server URL |
| `RUNBOOK_TOKEN` | profile token |
| `RUNBOOK_TEAM` | profile teamId |
| `RUNBOOK_PROFILE` | active profile name |

## Web UI — Copy Token

If you're logged in via the browser, click the user icon (top-right) → **Copy token** to copy your JWT for use with the CLI.
```

---

## Self-Review

**Spec coverage check:**
- ✅ `runbook login` — Task 3
- ✅ `runbook logout` — Task 4
- ✅ `runbook whoami` — Task 4
- ✅ `runbook profile list` / `profile use` — Task 5
- ✅ `runbook team list` / `team use` — Task 6
- ✅ `publish` reads from profile — Task 7
- ✅ `install` reads from profile — Task 8
- ✅ Env var overrides (`RUNBOOK_SERVER`, `RUNBOOK_TOKEN`, `RUNBOOK_TEAM`, `RUNBOOK_PROFILE`) — Task 2 (`config.ts`)
- ✅ Web UserMenu with Copy token — Task 10
- ✅ Web TopBar integration — Task 11
- ✅ CLI README — Task 12

**Type consistency check:**
- `Profile` type defined in `config.ts` Task 2, used in all command tasks — consistent
- `resolveServer(opts, profile)` / `resolveToken(opts, profile)` / `resolveTeamId(opts, profile)` — all defined in Task 2 and used in Tasks 6, 7, 8 with matching signatures
- `getActiveProfile(profileName?)` — defined in Task 2, called with `opts.profile` (string | undefined) in all commands — correct
- `upsertProfile(name, updates)` — defined in Task 2, called with `{ teamId }` in Task 6 — correct

**Placeholder scan:** None found.
