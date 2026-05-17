// packages/cli/src/commands/diff.ts
// `runbook diff <oldBundle> <newBundle>` — output a human-readable Markdown diff.
import { Command } from 'commander'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { bundleDiffToMarkdown, type BundleLike } from '@runbook/shared/diff/markdown'

async function readBundle(filePath: string): Promise<BundleLike> {
  let raw: string
  try {
    raw = await readFile(resolve(filePath), 'utf-8')
  } catch {
    console.error(`Error: Cannot read file "${filePath}"`)
    process.exit(1)
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    console.error(`Error: "${filePath}" is not valid JSON`)
    process.exit(1)
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('id' in parsed) ||
    !('name' in parsed) ||
    !('versions' in parsed)
  ) {
    console.error(`Error: "${filePath}" does not look like a ProjectBundle (missing id/name/versions)`)
    process.exit(1)
  }

  return parsed as BundleLike
}

export const diffCommand = new Command('diff')
  .description('Output a Markdown diff between two bundle files')
  .argument('<oldBundle>', 'Path to the old bundle JSON file')
  .argument('<newBundle>', 'Path to the new bundle JSON file')
  .action(async (oldFile: string, newFile: string) => {
    const prev = await readBundle(oldFile)
    const next = await readBundle(newFile)
    const markdown = bundleDiffToMarkdown(prev, next)
    process.stdout.write(markdown)
  })
