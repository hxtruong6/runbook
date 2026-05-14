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
