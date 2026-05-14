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
