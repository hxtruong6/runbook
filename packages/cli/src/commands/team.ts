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
