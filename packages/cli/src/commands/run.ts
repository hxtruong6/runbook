// packages/cli/src/commands/run.ts
import { Command } from 'commander'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import pc from 'picocolors'
import {
  ProjectBundleSchema,
  buildRegistryFromData,
  runScenarioFrom,
  type BlockRunResult,
  type Environment,
  type RuntimeContext,
  type Scenario,
} from '@runbook/shared'

function parseVar(input: string): [string, string] {
  const idx = input.indexOf('=')
  if (idx === -1) throw new Error(`Invalid --var "${input}" — expected key=value`)
  return [input.slice(0, idx), input.slice(idx + 1)]
}

export const runCommand = new Command('run')
  .description('Run a scenario from a bundle file')
  .argument('<bundle>', 'Path to a .bundle.json file')
  .argument('<scenarioId>', 'Scenario id to run')
  .option('--env <name>', 'Environment name (defaults to first environment)')
  .option('--var <kv...>', 'Set a context variable (key=value), repeatable')
  .option('--version <semver>', 'Bundle version (defaults to last version)')
  .option('--json', 'Emit machine-readable JSON to stdout')
  .action(
    async (
      bundlePath: string,
      scenarioId: string,
      opts: { env?: string; var?: string[]; version?: string; json?: boolean }
    ) => {
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
        console.error(pc.red('Error: bundle failed schema validation'))
        for (const issue of result.error.issues) {
          console.error(`  ${issue.path.join('.')}: ${issue.message}`)
        }
        process.exit(2)
        return
      }
      const bundle = result.data

      const version =
        (opts.version
          ? bundle.versions.find((v) => v.version === opts.version)
          : bundle.versions[bundle.versions.length - 1]) ?? null

      if (!version) {
        console.error(pc.red(`Error: no version found${opts.version ? ` "${opts.version}"` : ''}`))
        process.exit(2)
        return
      }

      const scenario = version.scenarios.find((s) => s.id === scenarioId) as Scenario | undefined
      if (!scenario) {
        console.error(pc.red(`Error: scenario "${scenarioId}" not found in bundle`))
        console.error(`Available: ${version.scenarios.map((s) => s.id).join(', ') || '(none)'}`)
        process.exit(2)
        return
      }

      let env: Environment | null = null
      if (version.environments.length > 0) {
        if (opts.env) {
          env = (version.environments.find((e) => e.name === opts.env) ??
            null) as Environment | null
          if (!env) {
            console.error(pc.red(`Error: environment "${opts.env}" not found`))
            console.error(
              `Available: ${version.environments.map((e) => e.name).join(', ')}`
            )
            process.exit(2)
            return
          }
        } else {
          env = version.environments[0] as Environment
        }
      }

      const baseUrl = env?.baseUrl ?? ''
      const registry = buildRegistryFromData(version.blocks, () => baseUrl)

      const vars: Record<string, unknown> = {}
      for (const raw of opts.var ?? []) {
        const [k, v] = parseVar(raw)
        vars[k] = v
      }

      const initialCtx: RuntimeContext = {
        socketSessionUuid: '',
        ...vars,
      }

      const scenarioLookup = (id: string) =>
        (version.scenarios.find((s) => s.id === id) as Scenario | undefined) ?? null

      const results: Array<{ idx: number; kind: string; result: BlockRunResult }> = []

      await runScenarioFrom(
        scenario.blocks,
        0,
        initialCtx,
        (_ctx, idx, result) => {
          const kind = scenario.blocks[idx]?.kind ?? '?'
          results.push({ idx, kind, result })
          if (!opts.json) {
            if (result.status === 'ok') {
              const status = 'httpStatus' in result ? result.httpStatus : 0
              console.log(
                `${pc.green('✓')} ${pc.bold(`#${idx + 1}`)} ${pc.dim(kind)} ${pc.dim(`(${status}, ${result.elapsedMs}ms)`)}`
              )
            } else {
              console.log(
                `${pc.red('✗')} ${pc.bold(`#${idx + 1}`)} ${pc.dim(kind)} ${pc.red(result.error)}`
              )
            }
          }
        },
        { registry, scenarioLookup, env }
      )

      const failed = results.some((r) => r.result.status === 'err')

      if (opts.json) {
        process.stdout.write(
          JSON.stringify(
            {
              scenarioId,
              bundleId: bundle.id,
              version: version.version,
              env: env?.name ?? null,
              ok: !failed,
              results,
            },
            null,
            2
          ) + '\n'
        )
      } else {
        if (failed) {
          console.error(pc.red('\nFAIL'))
        } else {
          console.log(pc.green('\nOK'))
        }
      }

      process.exit(failed ? 1 : 0)
    }
  )
