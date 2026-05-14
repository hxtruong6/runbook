// src/blocks/startChairside.ts
import type { BlockDef } from "./types";
import { getBaseUrl } from "../api/config";

export const startChairsideDef: BlockDef = {
  kind: "startChairside",
  label: "§5 Start chairside review",
  auth: "none",
  hidden: true,
  inputs: [
    { name: "firstName", label: "First name", type: "string", required: true },
    { name: "lastName", label: "Last name", type: "string", required: true },
    { name: "practiceId", label: "Practice ID", type: "string", required: true, fromContextKey: "practiceId" },
    {
      name: "orthoReviewChairsideToken",
      label: "Chairside token",
      type: "string",
      required: true,
      fromContextKey: "orthoReviewChairsideToken",
    },
  ],
  outputs: [
    { jsonPath: "syncToken", contextKey: "syncToken" },
    { jsonPath: "orthoReview.id", contextKey: "orthoReviewId" },
  ],
  build: (v) => ({
    method: "POST",
    url: `${getBaseUrl()}/v1/aligner/user/ortho-reviews/chairside`,
    headers: { accept: "application/json" },
    body: {
      firstName: v.firstName,
      lastName: v.lastName,
      practiceId: v.practiceId,
      orthoReviewChairsideToken: v.orthoReviewChairsideToken,
    },
  }),
};
