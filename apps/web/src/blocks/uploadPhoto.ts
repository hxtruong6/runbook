// src/blocks/uploadPhoto.ts
import type { BlockDef } from "./types";
import { getBaseUrl } from "../api/config";

const SLOTS = [
  "chairside-full-face",
  "chairside-close-up",
  "chairside-upper-arch",
  "chairside-lower-arch",
] as const;

export const uploadPhotoDef: BlockDef = {
  kind: "uploadPhoto",
  label: "§6 Upload photo",
  auth: "none",
  hidden: true,
  inputs: [
    { name: "orthoReviewId", label: "Ortho review ID", type: "string", required: true, fromContextKey: "orthoReviewId" },
    { name: "syncToken", label: "Sync token", type: "string", required: true, fromContextKey: "syncToken" },
    { name: "slot", label: "Slot", type: "enum", required: true, enumValues: SLOTS },
    { name: "url", label: "Photo URL", type: "string", required: true, placeholder: "https://..." },
    { name: "socketSessionUuid", label: "Socket session UUID (optional)", type: "string", fromContextKey: "socketSessionUuid" },
  ],
  outputs: [],
  build: (v) => {
    const qs = v.socketSessionUuid ? `?socketSessionUuid=${encodeURIComponent(String(v.socketSessionUuid))}` : "";
    return {
      method: "POST",
      url: `${getBaseUrl()}/v1/aligner/user/ortho-reviews/chairside/${v.orthoReviewId}/photos${qs}`,
      headers: { accept: "application/json" },
      body: { syncToken: v.syncToken, slot: v.slot, url: v.url },
    };
  },
};
