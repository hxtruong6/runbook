import type { BlockDef } from "./types";
import { API_BASE_URL } from "../api/config";

export const getOrthoReviewDef: BlockDef = {
  kind: "getOrthoReview",
  label: "§7 Get ortho review (DENTIST)",
  auth: "cookie-or-jwt",
  inputs: [
    { name: "orthoReviewId", label: "Ortho review ID", type: "string", required: true, fromContextKey: "orthoReviewId" },
  ],
  outputs: [{ jsonPath: "$", contextKey: "orthoReview" }],
  build: (v) => ({
    method: "GET",
    url: `${API_BASE_URL}/v1/aligner/dentist/ortho-reviews/${v.orthoReviewId}`,
    headers: { accept: "application/json", "x-client-version": "0.4.0" },
  }),
};
