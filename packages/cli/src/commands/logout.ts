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
