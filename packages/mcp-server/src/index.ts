#!/usr/bin/env node
// packages/mcp-server/src/index.ts
// Runbook MCP server — takes a bundle path via argv and exposes each scenario
// in the active version as an MCP tool.

import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import {
  parseBundle,
  resolveActiveVersion,
  buildRegistry,
  runScenarioFrom,
  type Fetcher,
  type RuntimeContext,
  type BlockRunResult,
  type BlockDefData,
  type Scenario,
  type Environment,
} from '@runbook/shared/runtime'

// ---------------------------------------------------------------------------
// Tool-name sanitisation
// MCP tool names: must match [a-zA-Z0-9_-]+ (max 64 chars)
// ---------------------------------------------------------------------------

export function sanitizeToolName(id: string): string {
  return (
    id
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 64) || 'scenario'
  )
}

// ---------------------------------------------------------------------------
// JSON Schema derivation from FieldSpec[]
// ---------------------------------------------------------------------------

export function buildInputSchema(
  fields: BlockDefData['inputs'],
): Record<string, unknown> {
  const properties: Record<string, unknown> = {}
  const required: string[] = []

  for (const field of fields) {
    let prop: Record<string, unknown>
    switch (field.type) {
      case 'number':
        prop = { type: 'number', description: field.label }
        break
      case 'enum':
        prop = {
          type: 'string',
          description: field.label,
          enum: field.enumValues ?? [],
        }
        break
      case 'json':
        prop = { type: 'object', description: field.label }
        break
      case 'password':
      case 'string':
      default:
        prop = { type: 'string', description: field.label }
        break
    }
    if (field.placeholder) prop['examples'] = [field.placeholder]
    properties[field.name] = prop
    if (field.required) required.push(field.name)
  }

  return {
    type: 'object',
    properties,
    ...(required.length > 0 ? { required } : {}),
  }
}

// ---------------------------------------------------------------------------
// Build a zod v3 shape from aggregated field specs
// ---------------------------------------------------------------------------

type ZodV3Shape = Record<string, z.ZodTypeAny>

function buildZodShape(fields: BlockDefData['inputs']): ZodV3Shape {
  const shape: ZodV3Shape = {}
  for (const field of fields) {
    let zodType: z.ZodTypeAny
    switch (field.type) {
      case 'number':
        zodType = z.number().describe(field.label)
        break
      case 'enum':
        if (field.enumValues && field.enumValues.length > 0) {
          zodType = z.enum(field.enumValues as [string, ...string[]]).describe(field.label)
        } else {
          zodType = z.string().describe(field.label)
        }
        break
      case 'json':
        zodType = z.record(z.string(), z.unknown()).describe(field.label)
        break
      case 'password':
      case 'string':
      default:
        zodType = z.string().describe(field.label)
        break
    }
    shape[field.name] = field.required ? zodType : zodType.optional()
  }
  return shape
}

// ---------------------------------------------------------------------------
// Aggregate inputs from a scenario: collect required fields across all blocks
// ---------------------------------------------------------------------------

function aggregateScenarioInputs(
  scenario: Scenario,
  registry: Record<string, BlockDefData>,
): BlockDefData['inputs'] {
  const seen = new Set<string>()
  const inputs: BlockDefData['inputs'] = []

  for (const inst of scenario.blocks) {
    const def = registry[inst.kind]
    if (!def) continue
    for (const field of def.inputs) {
      if (!seen.has(field.name)) {
        // Skip fields that have a static override in the scenario
        if (
          field.name in inst.overrides &&
          inst.overrides[field.name] !== '' &&
          inst.overrides[field.name] !== undefined
        )
          continue
        seen.add(field.name)
        inputs.push(field)
      }
    }
  }
  return inputs
}

// ---------------------------------------------------------------------------
// createServer — builds and returns the McpServer (exported for tests)
// ---------------------------------------------------------------------------

export async function createServer(opts: {
  bundlePath: string
  fetcher?: Fetcher
}): Promise<McpServer> {
  // 1. Load and parse the bundle
  const raw = await readFile(resolve(opts.bundlePath), 'utf-8')
  const bundle = parseBundle(JSON.parse(raw))

  // 2. Resolve active version
  const activeVersionStr = resolveActiveVersion(bundle.versions)
  const activeVersion = bundle.versions.find((v) => v.version === activeVersionStr)
  if (!activeVersion) throw new Error('Bundle has no versions')

  const firstEnv: Environment | undefined = activeVersion.environments[0]
  const registry = buildRegistry(activeVersion.blocks, () => firstEnv?.baseUrl ?? '')
  const blockDataByKind: Record<string, BlockDefData> = Object.fromEntries(
    activeVersion.blocks.map((b) => [b.kind, b]),
  )
  const fetcher = opts.fetcher ?? (globalThis.fetch as unknown as Fetcher)

  // 3. Build McpServer
  const server = new McpServer(
    { name: `runbook:${bundle.id}`, version: activeVersionStr },
    {
      instructions: `Runbook bundle "${bundle.name}". Each tool is a scenario workflow. Provide the required inputs and the tool will execute the API flow and return results.`,
    },
  )

  // Scenario lookup for scenario-ref blocks
  const scenarioLookup = (id: string): Scenario | null =>
    activeVersion.scenarios.find((s) => s.id === id) ?? null

  // 4. Register one tool per scenario
  for (const scenario of activeVersion.scenarios) {
    const toolName = sanitizeToolName(scenario.id)
    const aggregatedInputs = aggregateScenarioInputs(scenario, blockDataByKind)
    const zodShape = buildZodShape(aggregatedInputs)

    // Capture for closure
    const currentScenario = scenario

    server.registerTool(
      toolName,
      {
        description: currentScenario.name,
        inputSchema: zodShape,
        annotations: {
          title: currentScenario.name,
          readOnlyHint: false,
          openWorldHint: true,
        },
      },
      async (inputs: Record<string, unknown>, extra) => {
        // Progress token for long-running notifications
        const progressToken = extra._meta?.progressToken

        // Build initial context from tool inputs
        const initialCtx: RuntimeContext = { ...inputs, socketSessionUuid: 'mcp' }

        const blockResults: Array<{
          blockId: string
          kind: string
          result: BlockRunResult
        }> = []
        let finalCtx: RuntimeContext = initialCtx
        const totalBlocks = currentScenario.blocks.length

        try {
          await runScenarioFrom(
            currentScenario.blocks,
            0,
            initialCtx,
            async (updatedCtx: RuntimeContext, idx: number, result: BlockRunResult) => {
              finalCtx = updatedCtx
              const inst = currentScenario.blocks[idx]!
              blockResults.push({ blockId: inst.id, kind: inst.kind, result })

              if (progressToken !== undefined) {
                try {
                  await extra.sendNotification({
                    method: 'notifications/progress',
                    params: {
                      progressToken,
                      progress: idx + 1,
                      total: totalBlocks,
                      message: `Block ${idx + 1}/${totalBlocks}: ${inst.kind}`,
                    },
                  })
                } catch {
                  // Progress notification is best-effort
                }
              }
            },
            { env: firstEnv ?? null, registry, fetcher, scenarioLookup },
          )
        } catch (e) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `Error running scenario: ${(e as Error).message}`,
              },
            ],
            isError: true,
          }
        }

        // Build result summary
        const summary = {
          scenario: currentScenario.name,
          scenarioId: currentScenario.id,
          blocksRun: blockResults.length,
          success: blockResults.every((r) => r.result.status === 'ok'),
          context: finalCtx,
          blocks: blockResults.map((r) => ({
            blockId: r.blockId,
            kind: r.kind,
            status: r.result.status,
            httpStatus: r.result.status === 'ok' ? r.result.httpStatus : r.result.httpStatus,
            elapsedMs: r.result.elapsedMs,
            response: r.result.response,
            ...(r.result.status === 'err' ? { error: r.result.error } : {}),
            ...(r.result.status === 'ok' ? { captured: r.result.captured } : {}),
          })),
        }

        const hasError = blockResults.some((r) => r.result.status === 'err')
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(summary, null, 2),
            },
          ],
          ...(hasError ? { isError: true } : {}),
        }
      },
    )
  }

  return server
}

// ---------------------------------------------------------------------------
// Main — only runs when invoked directly (not in tests)
// ---------------------------------------------------------------------------

async function main() {
  const bundlePath = process.argv[2]
  if (!bundlePath) {
    console.error('Usage: runbook-mcp <bundle.json>')
    process.exit(1)
  }

  let server: McpServer
  try {
    server = await createServer({ bundlePath })
  } catch (e) {
    console.error(`Error loading bundle: ${(e as Error).message}`)
    process.exit(1)
    return
  }

  const transport = new StdioServerTransport()
  await server.connect(transport)

  console.error(`Runbook MCP server running on stdio (bundle: ${bundlePath})`)

  process.on('SIGINT', async () => {
    await server.close()
    process.exit(0)
  })
}

// Only run main when executed directly
const isMain =
  typeof process !== 'undefined' &&
  process.argv[1] != null &&
  (process.argv[1].endsWith('index.js') || process.argv[1].endsWith('index.ts'))

if (isMain) {
  main().catch((e: unknown) => {
    console.error(e)
    process.exit(1)
  })
}
