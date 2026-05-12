// src/blocks/verifyDeviceToken.ts
import type { BlockDef } from "./types";
import { API_BASE_URL } from "../api/config";

export const verifyDeviceTokenDef: BlockDef = {
  kind: "verifyDeviceToken",
  label: "§4 Verify device token (phone first-pair)",
  auth: "none",
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
    url: `${API_BASE_URL}/v1/aligner/user/ortho-reviews/chairside/device-token`,
    headers: { accept: "application/json" },
    body: { token: v.orthoReviewChairsideToken },
  }),
};
