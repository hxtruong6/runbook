// tests/share/badge.test.ts
// Verifies the SVG badge files exist and contain the expected text / attributes.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const REPO_ROOT = resolve(__dirname, '../../../../')

describe('badge SVGs', () => {
  it('badge-light.svg contains "Run in Runbook" text', () => {
    const svg = readFileSync(resolve(REPO_ROOT, 'docs/assets/badge-light.svg'), 'utf-8')
    expect(svg).toContain('Run in Runbook')
  })

  it('badge-dark.svg contains "Run in Runbook" text', () => {
    const svg = readFileSync(resolve(REPO_ROOT, 'docs/assets/badge-dark.svg'), 'utf-8')
    expect(svg).toContain('Run in Runbook')
  })

  it('badge-light.svg uses violet primary color (#6741D9)', () => {
    const svg = readFileSync(resolve(REPO_ROOT, 'docs/assets/badge-light.svg'), 'utf-8')
    expect(svg).toContain('#6741D9')
  })

  it('badge-dark.svg uses violet shade (#845EF7)', () => {
    const svg = readFileSync(resolve(REPO_ROOT, 'docs/assets/badge-dark.svg'), 'utf-8')
    expect(svg).toContain('#845EF7')
  })

  it('badge-light.svg has role="img" accessibility attribute', () => {
    const svg = readFileSync(resolve(REPO_ROOT, 'docs/assets/badge-light.svg'), 'utf-8')
    expect(svg).toContain('role="img"')
  })

  it('badge-dark.svg has role="img" accessibility attribute', () => {
    const svg = readFileSync(resolve(REPO_ROOT, 'docs/assets/badge-dark.svg'), 'utf-8')
    expect(svg).toContain('role="img"')
  })
})
