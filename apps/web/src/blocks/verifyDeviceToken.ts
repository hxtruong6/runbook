// src/blocks/verifyDeviceToken.ts
import type { BlockDef } from "./types";
import { getBaseUrl } from "../api/config";

export const verifyDeviceTokenDef: BlockDef = {
  kind: "verifyDeviceToken",
  label: "§4 Verify device token (phone first-pair)",
  auth: "none",
  hidden: true,
  inputs: [
    {
      name: "orthoReviewChairsideToken",
      label: "Chairside install token",
      type: "string",
      required: true,
      fromContextKey: "orthoReviewChairsideToken",
    },
  ],
  outputs: [
    { jsonPath: "user.id", contextKey: "userId" },
    { jsonPath: "practices[0].id", contextKey: "practiceId" },
    { jsonPath: "corporate", contextKey: "corporate" },
  ],
  build: (v) => ({
    method: "POST",
    url: `${getBaseUrl()}/v1/aligner/user/ortho-reviews/chairside/device-token`,
    headers: { accept: "application/json" },
    body: { token: v.orthoReviewChairsideToken },
  }),
};
