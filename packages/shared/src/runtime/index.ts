export * from './types.js'
export * from './capture.js'
export * from './fetcher.js'
export * from './scenarioRef.js'
export * from './bundle.js'
export * from './dataBlock.js'
export * from './timer.js'
export {
  resolveInputs,
  runBlock,
  runOneBlock,
  runScenarioFrom,
  type RunOptions,
} from './runner.js'

import { ProjectBundleSchema, type ProjectBundle, type BundleVersion, type BlockDefData } from './bundle.js'
import { buildRegistryFromData } from './dataBlock.js'

export function parseBundle(raw: unknown): ProjectBundle {
  return ProjectBundleSchema.parse(raw)
}

export function resolveActiveVersion(versions: BundleVersion[]): string {
  if (versions.length === 0) throw new Error('Bundle has no versions')
  return versions[versions.length - 1]!.version
}

export const buildRegistry = (blocks: BlockDefData[], resolveBaseUrl: () => string = () => '') =>
  buildRegistryFromData(blocks, resolveBaseUrl)
