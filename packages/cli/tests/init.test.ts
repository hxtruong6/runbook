// packages/cli/tests/init.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, readFile, rm, access } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { initCommand } from '../src/commands/init.js'

async function fileExists(p: string): Promise<boolean> {
  return access(p).then(() => true).catch(() => false)
}

describe('runbook init', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'runbook-init-'))
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  async function runInit(args: string[] = []) {
    // Parse the command in the context of the tmp dir without actually calling process.parse
    await initCommand.parseAsync([tmpDir, ...args], { from: 'user' })
  }

  it('creates runbook.json', async () => {
    await runInit()
    const bundlePath = join(tmpDir, 'runbook.json')
    expect(await fileExists(bundlePath)).toBe(true)
  })

  it('runbook.json is valid JSON with expected shape', async () => {
    await runInit()
    const raw = await readFile(join(tmpDir, 'runbook.json'), 'utf-8')
    const bundle = JSON.parse(raw) as Record<string, unknown>
    expect(bundle).toHaveProperty('id')
    expect(bundle).toHaveProperty('name')
    expect(bundle).toHaveProperty('versions')
    expect(Array.isArray(bundle['versions'])).toBe(true)
  })

  it('creates README.md', async () => {
    await runInit()
    expect(await fileExists(join(tmpDir, 'README.md'))).toBe(true)
  })

  it('README.md contains Run in Runbook badge link', async () => {
    await runInit()
    const readme = await readFile(join(tmpDir, 'README.md'), 'utf-8')
    expect(readme).toContain('https://runbook.app/run?bundle=')
    expect(readme).toContain('Run in Runbook')
  })

  it('creates .github/workflows/validate-bundle.yml', async () => {
    await runInit()
    const workflowPath = join(tmpDir, '.github', 'workflows', 'validate-bundle.yml')
    expect(await fileExists(workflowPath)).toBe(true)
  })

  it('validate-bundle.yml references @runbook/cli and runbook validate', async () => {
    await runInit()
    const workflow = await readFile(
      join(tmpDir, '.github', 'workflows', 'validate-bundle.yml'),
      'utf-8',
    )
    expect(workflow).toContain('@runbook/cli')
    expect(workflow).toContain('runbook validate runbook.json')
  })

  it('does not overwrite existing runbook.json', async () => {
    const bundlePath = join(tmpDir, 'runbook.json')
    const original = JSON.stringify({ id: 'existing', name: 'Existing', versions: [] })
    await (await import('node:fs/promises')).writeFile(bundlePath, original, 'utf-8')
    await runInit()
    const after = await readFile(bundlePath, 'utf-8')
    expect(after).toBe(original) // unchanged
  })

  it('embeds --raw-url in the README badge', async () => {
    const rawUrl = 'https://raw.githubusercontent.com/acme/api/main/runbook.json'
    await runInit(['--raw-url', rawUrl])
    const readme = await readFile(join(tmpDir, 'README.md'), 'utf-8')
    expect(readme).toContain(encodeURIComponent(rawUrl))
  })
})
