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
