// packages/cli/src/commands/init.ts
// Scaffolds a GitHub-ready Runbook repo: runbook.json + README with badge + validate workflow.
import { Command } from 'commander'
import { mkdir, writeFile, access } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import pc from 'picocolors'

const SAMPLE_BUNDLE = {
  id: 'my-runbook',
  name: 'My Runbook',
  description: 'A Runbook bundle. Edit this file to add your API workflows.',
  createdAt: new Date().toISOString(),
  versions: [
    {
      version: '0.1.0',
      releasedAt: new Date().toISOString().slice(0, 10),
      releaseNotes: 'Initial release',
      changes: [{ type: 'added', target: 'ping', summary: 'GET /' }],
      blocks: [
        {
          kind: 'ping',
          label: 'Ping (GET /)',
          auth: 'none',
          inputs: [],
          outputs: [],
          request: {
            method: 'GET',
            urlTemplate: '/',
            headers: { accept: 'application/json' },
          },
        },
      ],
      scenarios: [
        {
          id: 'smoke',
          name: 'Smoke test',
          createdAt: new Date().toISOString(),
          blocks: [{ id: 'b1', kind: 'ping', overrides: {} }],
        },
      ],
      environments: [],
      docs: {},
    },
  ],
}

function validateWorkflow(): string {
  return `name: Validate Runbook Bundle

on:
  push:
    paths: ['runbook.json']
  pull_request:
    paths: ['runbook.json']

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm install -g @runbook/cli
      - run: runbook validate runbook.json
`
}

function readmeContent(name: string, rawUrl: string): string {
  return `# ${name}

[![Run in Runbook](https://runbook.app/badge.svg)](https://runbook.app/run?bundle=${encodeURIComponent(rawUrl)})

This repository contains a [Runbook](https://runbook.app) bundle — a versioned,
executable API workflow definition.

## Quick start

\`\`\`bash
runbook validate runbook.json
runbook run runbook.json smoke
\`\`\`

\`runbook.json\` is the source of truth.
`
}

export const initCommand = new Command('init')
  .description('Scaffold a GitHub-ready Runbook repo (runbook.json + README + CI workflow)')
  .argument('[dir]', 'Target directory (default: current directory)', '.')
  .option('--raw-url <url>', 'Raw URL of runbook.json for the README badge')
  .action(async (dir: string, opts: { rawUrl?: string }) => {
    const target = resolve(dir)
    const name = target.split('/').pop() ?? 'my-runbook'
    const rawUrl =
      opts.rawUrl ?? `https://raw.githubusercontent.com/<owner>/<repo>/main/runbook.json`

    await mkdir(target, { recursive: true })
    await mkdir(join(target, '.github', 'workflows'), { recursive: true })

    const bundlePath = join(target, 'runbook.json')
    const bundleExists = await access(bundlePath).then(() => true).catch(() => false)
    if (bundleExists) {
      console.log(`  skip   runbook.json (already exists)`)
    } else {
      const bundle = { ...SAMPLE_BUNDLE, id: name, name }
      await writeFile(bundlePath, JSON.stringify(bundle, null, 2) + '\n', 'utf-8')
      console.log(`  create runbook.json`)
    }

    await writeFile(join(target, 'README.md'), readmeContent(name, rawUrl), 'utf-8')
    console.log(`  create README.md`)

    await writeFile(
      join(target, '.github', 'workflows', 'validate-bundle.yml'),
      validateWorkflow(),
      'utf-8'
    )
    console.log(`  create .github/workflows/validate-bundle.yml`)

    console.log('')
    console.log(pc.green(`✓ Runbook repo scaffolded at ${target}`))
    console.log('')
    console.log('Next:')
    console.log(`  ${pc.bold(`cd ${dir} && runbook run runbook.json smoke`)}`)
  })
