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
