// packages/cli/src/commands/init.ts
import { Command } from 'commander'
import { mkdir, writeFile, access } from 'node:fs/promises'
import { resolve } from 'node:path'
import pc from 'picocolors'

const SAMPLE_BUNDLE = {
  id: 'sample-bundle',
  name: 'Sample Bundle',
  description: 'A starter bundle with one block and one scenario.',
  createdAt: new Date().toISOString(),
  versions: [
    {
      version: '0.1.0',
      releasedAt: new Date().toISOString(),
      releaseNotes: 'Initial bundle.',
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
      environments: [
        {
          id: 'default',
          name: 'default',
          baseUrl: 'https://httpbin.org',
          auth: { kind: 'none' },
          headers: {},
          createdAt: new Date().toISOString(),
        },
      ],
      docs: {},
    },
  ],
}

const README = `# {{name}}

A Runbook bundle scaffolded with \`runbook init\`.

## Run it

\`\`\`bash
runbook validate runbook.json
runbook run runbook.json smoke
\`\`\`

## Edit

\`runbook.json\` is the source of truth. See https://github.com/runbook for schema docs.
`

export const initCommand = new Command('init')
  .description('Scaffold a new Runbook bundle in <name>/')
  .argument('<name>', 'Folder name to create')
  .action(async (name: string) => {
    const dir = resolve(name)
    try {
      await access(dir)
      console.error(pc.red(`Error: "${dir}" already exists`))
      process.exit(1)
      return
    } catch {
      /* not present — good */
    }

    await mkdir(dir, { recursive: true })
    const bundle = { ...SAMPLE_BUNDLE, id: name, name }
    await writeFile(
      resolve(dir, 'runbook.json'),
      JSON.stringify(bundle, null, 2) + '\n',
      'utf-8'
    )
    await writeFile(resolve(dir, 'README.md'), README.replace('{{name}}', name), 'utf-8')

    console.log(pc.green(`✓ Scaffolded ${name}/`))
    console.log(`  ${pc.dim('runbook.json')}`)
    console.log(`  ${pc.dim('README.md')}`)
    console.log()
    console.log(`Next: ${pc.bold(`cd ${name} && runbook run runbook.json smoke`)}`)
  })
