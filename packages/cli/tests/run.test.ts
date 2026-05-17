import { describe, it, expect } from 'vitest'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'

const CLI = resolve(__dirname, '../src/index.ts')
const FIXTURE = resolve(__dirname, 'fixtures/sample.bundle.json')

function runCli(args: string[]) {
  return spawnSync('node', ['--import', 'tsx', CLI, ...args], {
    encoding: 'utf-8',
    timeout: 30_000,
  })
}

describe('runbook validate', () => {
  it('exits 0 on valid bundle', () => {
    const r = runCli(['validate', FIXTURE])
    expect(r.status).toBe(0)
    expect(r.stdout).toMatch(/Valid bundle/)
  })

  it('exits 2 on malformed JSON', () => {
    const tmp = mkdtempSync(resolve(tmpdir(), 'rbcli-'))
    try {
      const f = resolve(tmp, 'bad.json')
      writeFileSync(f, '{ not json')
      const r = runCli(['validate', f])
      expect(r.status).toBe(2)
      expect(r.stderr).toMatch(/invalid JSON/i)
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  })

  it('exits 2 on schema-invalid bundle', () => {
    const tmp = mkdtempSync(resolve(tmpdir(), 'rbcli-'))
    try {
      const f = resolve(tmp, 'bad.json')
      writeFileSync(f, JSON.stringify({ id: 'x' }))
      const r = runCli(['validate', f])
      expect(r.status).toBe(2)
      expect(r.stderr).toMatch(/Invalid bundle/)
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  })
})

describe('runbook run', () => {
  it('runs a scenario and emits JSON; exits 1 when network fails', () => {
    const r = runCli(['run', FIXTURE, 'smoke', '--json'])
    // The bundle points at an unreachable host → the block will fail.
    expect(r.status).toBe(1)
    const parsed = JSON.parse(r.stdout)
    expect(parsed.bundleId).toBe('test-bundle')
    expect(parsed.scenarioId).toBe('smoke')
    expect(parsed.ok).toBe(false)
    expect(parsed.results).toHaveLength(1)
    expect(parsed.results[0].result.status).toBe('err')
  })

  it('exits 2 when scenario id is missing', () => {
    const r = runCli(['run', FIXTURE, 'no-such-scenario', '--json'])
    expect(r.status).toBe(2)
    expect(r.stderr).toMatch(/not found/)
  })
})

describe('runbook init', () => {
  it('scaffolds a folder with runbook.json + README', () => {
    const tmp = mkdtempSync(resolve(tmpdir(), 'rbcli-'))
    try {
      const target = resolve(tmp, 'demo')
      const r = runCli(['init', target])
      expect(r.status).toBe(0)
      expect(existsSync(resolve(target, 'runbook.json'))).toBe(true)
      expect(existsSync(resolve(target, 'README.md'))).toBe(true)
      const bundle = JSON.parse(readFileSync(resolve(target, 'runbook.json'), 'utf-8'))
      expect(bundle.id).toBe(target)
      expect(bundle.versions[0].scenarios[0].id).toBe('smoke')
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  })
})
