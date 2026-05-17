// packages/cli/src/commands/init.ts
// `runbook init` — scaffold a GitHub-ready repo containing a sample runbook.json,
// a README with a "Run in Runbook" badge, and a GitHub Actions validate workflow.
import { Command } from 'commander'
import { mkdir, writeFile, access } from 'node:fs/promises'
import { join, resolve } from 'node:path'

// ---------------------------------------------------------------------------
// Sample bundle (minimal valid ProjectBundle)
// ---------------------------------------------------------------------------
const SAMPLE_BUNDLE = {
  id: 'my-runbook',
  name: 'My Runbook',
  description: 'A Runbook bundle. Edit this file to add your API workflows.',
  createdAt: new Date().toISOString(),
  versions: [
    {
      version: '1.0.0',
      releasedAt: new Date().toISOString().slice(0, 10),
      releaseNotes: 'Initial release',
      changes: [
        {
          type: 'added',
          summary: 'Initial bundle scaffolded via `runbook init`',
        },
      ],
      blocks: [],
      scenarios: [],
      environments: [],
      docs: {},
    },
  ],
}

// ---------------------------------------------------------------------------
// GitHub Actions: validate-bundle.yml
// ---------------------------------------------------------------------------
function validateWorkflow(): string {
  return `# .github/workflows/validate-bundle.yml
# Validates runbook.json on every push / pull-request.
name: Validate Runbook Bundle

on:
  push:
    paths:
      - 'runbook.json'
  pull_request:
    paths:
      - 'runbook.json'

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install Runbook CLI
        run: npm install -g @runbook/cli

      - name: Validate bundle
        run: runbook validate runbook.json
`
}

// ---------------------------------------------------------------------------
// README.md
// ---------------------------------------------------------------------------
function readmeContent(rawUrl: string): string {
  return `# My Runbook

[![Run in Runbook](https://runbook.app/badge.svg)](https://runbook.app/run?bundle=${encodeURIComponent(rawUrl)})

This repository contains a [Runbook](https://runbook.app) bundle — a versioned,
executable API workflow definition.

## Quick start

### Run in the browser

Click the badge above to import and run this bundle in the Runbook web app.

### Install via CLI

\`\`\`bash
npx @runbook/cli install my-runbook
\`\`\`

### Validate locally

\`\`\`bash
npx @runbook/cli validate runbook.json
\`\`\`

## Bundle structure

\`runbook.json\` contains a \`ProjectBundle\` — see the
[bundle format docs](https://runbook.app/docs/bundle-format) for the full schema.

## Contributing

1. Edit \`runbook.json\` to add or modify blocks and scenarios.
2. Open a pull request — the \`validate-bundle\` workflow will check your changes.
3. On merge the new version is published automatically (if you have the publish
   workflow configured).
`
}

// ---------------------------------------------------------------------------
// Command
// ---------------------------------------------------------------------------
export const initCommand = new Command('init')
  .description('Scaffold a GitHub-ready repo containing runbook.json + CI workflow')
  .argument('[dir]', 'Target directory (default: current directory)', '.')
  .option('--raw-url <url>', 'Raw URL of runbook.json for the README badge (placeholder if omitted)')
  .action(async (dir: string, opts: { rawUrl?: string }) => {
    const target = resolve(dir)
    const rawUrl =
      opts.rawUrl ??
      'https://raw.githubusercontent.com/<owner>/<repo>/main/runbook.json'

    // Ensure target directory exists
    await mkdir(target, { recursive: true })

    const githubDir = join(target, '.github', 'workflows')
    await mkdir(githubDir, { recursive: true })

    // Write runbook.json only if it doesn't already exist
    const bundlePath = join(target, 'runbook.json')
    const bundleExists = await access(bundlePath).then(() => true).catch(() => false)
    if (bundleExists) {
      console.log(`  skip  runbook.json (already exists)`)
    } else {
      await writeFile(bundlePath, JSON.stringify(SAMPLE_BUNDLE, null, 2) + '\n', 'utf-8')
      console.log(`  create  runbook.json`)
    }

    // Write README.md
    const readmePath = join(target, 'README.md')
    await writeFile(readmePath, readmeContent(rawUrl), 'utf-8')
    console.log(`  create  README.md`)

    // Write validate workflow
    const workflowPath = join(githubDir, 'validate-bundle.yml')
    await writeFile(workflowPath, validateWorkflow(), 'utf-8')
    console.log(`  create  .github/workflows/validate-bundle.yml`)

    console.log('')
    console.log('✓ Runbook repo scaffolded.')
    console.log('')
    console.log('Next steps:')
    console.log('  1. Edit runbook.json to add your API workflows.')
    console.log('  2. Push to GitHub — the validate workflow runs automatically on PRs.')
    console.log(`  3. Update the raw-url in README.md once you know your repo path.`)
    console.log(`     Badge URL: https://runbook.app/run?bundle=${encodeURIComponent(rawUrl)}`)
  })
