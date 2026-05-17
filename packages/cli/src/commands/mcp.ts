// packages/cli/src/commands/mcp.ts
// Thin wrapper: `runbook mcp <bundle>` spawns runbook-mcp with the bundle path.

import { Command } from 'commander'
import { spawn } from 'node:child_process'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'

export const mcpCommand = new Command('mcp')
  .description('Start an MCP server that exposes bundle scenarios as tools (stdio transport)')
  .argument('<bundle>', 'Path to the .bundle.json file')
  .action(async (bundle: string) => {
    const bundlePath = resolve(bundle)

    // Resolve the runbook-mcp binary from the mcp-server package
    let mcpBin = ''
    try {
      const req = createRequire(import.meta.url)
      const pkgJsonPath = req.resolve('@runbook/mcp-server/package.json')
      const pkgRaw = await readFile(pkgJsonPath, 'utf-8')
      const pkg = JSON.parse(pkgRaw) as { bin?: Record<string, string> }
      const binEntry = pkg.bin?.['runbook-mcp']
      if (binEntry) {
        mcpBin = join(dirname(pkgJsonPath), binEntry)
      }
    } catch {
      // package not found or not built — fall through to tsx fallback
    }

    if (!mcpBin) {
      // Fallback: use tsx to run the source directly (dev mode)
      const __dirUrl = new URL('.', import.meta.url)
      const __dir = fileURLToPath(__dirUrl)
      const srcPath = resolve(__dir, '../../..', 'mcp-server', 'src', 'index.ts')
      const child = spawn('tsx', [srcPath, bundlePath], { stdio: 'inherit' })
      child.on('exit', (code) => process.exit(code ?? 0))
      return
    }

    const child = spawn(process.execPath, [mcpBin, bundlePath], { stdio: 'inherit' })
    child.on('exit', (code) => process.exit(code ?? 0))
  })
