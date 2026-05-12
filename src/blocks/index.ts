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

export const BLOCK_REGISTRY: Record<string, BlockDef> = {
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

export function getBlockDef(kind: string): BlockDef {
  const def = BLOCK_REGISTRY[kind];
  if (!def) throw new Error(`Unknown block kind: ${kind}`);
  return def;
}
