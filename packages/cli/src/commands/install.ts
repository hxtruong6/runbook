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
      console.error(`Error: Could not reach server at ${opts.server}`)
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
    }

    const outputPath = resolve(opts.output ?? `${bundleId}.bundle.json`)
    await writeFile(outputPath, JSON.stringify(body.bundle, null, 2), 'utf-8')

    console.log(`✓ Installed`)
    console.log(`  Bundle ID  : ${body.bundleId}`)
    console.log(`  Version    : ${body.latestVersion}`)
    console.log(`  SHA-256    : ${body.hash} ✓ verified`)
    console.log(`  Saved to   : ${outputPath}`)
  })
