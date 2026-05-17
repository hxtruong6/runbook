// packages/cli/src/commands/validate.ts
import { Command } from 'commander'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import pc from 'picocolors'
import { ProjectBundleSchema } from '@runbook/shared'

export const validateCommand = new Command('validate')
  .description('Validate a bundle JSON file against the schema')
  .argument('<bundle>', 'Path to a .bundle.json file')
  .action(async (bundlePath: string) => {
    const filePath = resolve(bundlePath)
    let raw: string
    try {
      raw = await readFile(filePath, 'utf-8')
    } catch {
      console.error(pc.red(`Error: cannot read "${filePath}"`))
      process.exit(2)
      return
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch (e) {
      console.error(pc.red(`Error: invalid JSON — ${(e as Error).message}`))
      process.exit(2)
      return
    }

    const result = ProjectBundleSchema.safeParse(parsed)
    if (!result.success) {
      console.error(pc.red(`Invalid bundle — ${result.error.issues.length} issue(s):`))
      for (const issue of result.error.issues) {
        const path = issue.path.length ? issue.path.join('.') : '(root)'
        console.error(`  ${pc.yellow(path)}: ${issue.message}`)
      }
      process.exit(2)
      return
    }

    const bundle = result.data
    const versions = bundle.versions.length
    const blocks = bundle.versions.reduce((acc, v) => acc + v.blocks.length, 0)
    const scenarios = bundle.versions.reduce((acc, v) => acc + v.scenarios.length, 0)
    console.log(pc.green(`✓ Valid bundle "${bundle.id}"`))
    console.log(`  Versions  : ${versions}`)
    console.log(`  Blocks    : ${blocks}`)
    console.log(`  Scenarios : ${scenarios}`)
    process.exit(0)
  })
