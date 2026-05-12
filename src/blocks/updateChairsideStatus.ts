import type { BlockDef } from "./types";
import { API_BASE_URL } from "../api/config";

const STATUSES = ["IN_PROGRESS", "COMPLETED", "ARCHIVED"] as const;

export const updateChairsideStatusDef: BlockDef = {
  kind: "updateChairsideStatus",
  label: "§8 Update chairside status",
  auth: "none",
  inputs: [
    { name: "orthoReviewId", label: "Ortho review ID", type: "string", required: true, fromContextKey: "orthoReviewId" },
    { name: "syncToken", label: "Sync token", type: "string", required: true, fromContextKey: "syncToken" },
    { name: "chairsideStatus", label: "Chairside status", type: "enum", required: true, enumValues: STATUSES },
  ],
  outputs: [{ jsonPath: "chairsideStatus", contextKey: "chairsideStatus" }],
  build: (v) => ({
    method: "PUT",
    url: `${API_BASE_URL}/v1/aligner/user/ortho-reviews/chairside/${v.orthoReviewId}`,
    headers: { accept: "application/json" },
    body: { syncToken: v.syncToken, chairsideStatus: v.chairsideStatus },
  }),
};
