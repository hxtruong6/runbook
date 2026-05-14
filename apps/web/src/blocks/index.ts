import type { BlockDef } from "./types";
import { signinDef } from "./signin";
import { profileDef } from "./profile";
import { featureHighlightsGetDef, featureHighlightsDismissDef } from "./featureHighlights";
import { verifyDeviceTokenDef } from "./verifyDeviceToken";
import { startChairsideDef } from "./startChairside";
import { uploadPhotoDef } from "./uploadPhoto";
import { getOrthoReviewDef } from "./getOrthoReview";
import { updateChairsideStatusDef } from "./updateChairsideStatus";
import { socketConnectDef } from "./socketConnect";
import { dataDefToBlockDef, type BlockDefData } from "./dataBlock";
import { httpRequestDef } from "./httpRequest";

export const COMPILED_BLOCKS: Record<string, BlockDef> = {
  [httpRequestDef.kind]: httpRequestDef,
  [signinDef.kind]: signinDef,
  [profileDef.kind]: profileDef,
  [featureHighlightsGetDef.kind]: featureHighlightsGetDef,
  [featureHighlightsDismissDef.kind]: featureHighlightsDismissDef,
  [verifyDeviceTokenDef.kind]: verifyDeviceTokenDef,
  [startChairsideDef.kind]: startChairsideDef,
  [uploadPhotoDef.kind]: uploadPhotoDef,
  [getOrthoReviewDef.kind]: getOrthoReviewDef,
  [updateChairsideStatusDef.kind]: updateChairsideStatusDef,
  [socketConnectDef.kind]: socketConnectDef,
};

// Backwards compat export — existing imports keep working
export const BLOCK_REGISTRY = COMPILED_BLOCKS;

export function buildRegistry(
  dataDefs: BlockDefData[],
  resolveBaseUrl: () => string
): Record<string, BlockDef> {
  const registry: Record<string, BlockDef> = { ...COMPILED_BLOCKS };
  for (const d of dataDefs) {
    registry[d.kind] = dataDefToBlockDef(d, { resolveBaseUrl });
  }
  return registry;
}

export function getBlockDefFromRegistry(
  registry: Record<string, BlockDef>,
  kind: string
): BlockDef {
  const def = registry[kind];
  if (!def) throw new Error(`Unknown block kind: ${kind}`);
  return def;
}

export function getBlockDef(kind: string): BlockDef {
  return getBlockDefFromRegistry(COMPILED_BLOCKS, kind);
}
