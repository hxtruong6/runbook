import type { BlockDef } from "./types";
import { getBaseUrl } from "../api/config";

export const getOrthoReviewDef: BlockDef = {
  kind: "getOrthoReview",
  label: "§7 Get ortho review (DENTIST)",
  auth: "cookie-or-jwt",
  hidden: true,
  inputs: [
    { name: "orthoReviewId", label: "Ortho review ID", type: "string", required: true, fromContextKey: "orthoReviewId" },
  ],
  outputs: [{ jsonPath: "$", contextKey: "orthoReview" }],
  build: (v) => ({
    method: "GET",
    url: `${getBaseUrl()}/v1/aligner/dentist/ortho-reviews/${v.orthoReviewId}`,
    headers: { accept: "application/json", "x-client-version": "0.4.0" },
  }),
};
