import type { BlockDef } from "./types";
import { getBaseUrl } from "../api/config";

export const profileDef: BlockDef = {
  kind: "profile",
  label: "§1 Profile (GET /v1/user/auth/profile)",
  auth: "cookie-or-jwt",
  inputs: [],
  outputs: [
    { jsonPath: "orthoReviewChairsideToken", contextKey: "orthoReviewChairsideToken" },
    { jsonPath: "isChairsideEnabled", contextKey: "isChairsideEnabled" },
  ],
  build: () => ({
    method: "GET",
    url: `${getBaseUrl()}/v1/user/auth/profile`,
    headers: { accept: "application/json", "x-client-version": "0.4.0" },
  }),
};
