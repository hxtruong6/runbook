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
import { runCommand } from './commands/run.js'
import { validateCommand } from './commands/validate.js'
import { initCommand } from './commands/init.js'
import { mcpCommand } from './commands/mcp.js'
import { diffCommand } from './commands/diff.js'

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
program.addCommand(runCommand)
program.addCommand(validateCommand)
program.addCommand(initCommand)
program.addCommand(mcpCommand)
program.addCommand(diffCommand)

program.parse()
