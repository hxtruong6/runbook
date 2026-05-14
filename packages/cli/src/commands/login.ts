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
