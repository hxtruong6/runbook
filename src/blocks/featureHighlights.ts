import type { BlockDef } from "./types";
import { getBaseUrl } from "../api/config";

const baseFor = () => `${getBaseUrl()}/v1/aligner/dentist/feature-highlights`;
const headers = { accept: "application/json", "x-client-version": "0.4.0" };

export const featureHighlightsGetDef: BlockDef = {
  kind: "featureHighlightsGet",
  label: "§2 Feature highlights — GET",
  auth: "cookie-or-jwt",
  inputs: [],
  outputs: [
    { jsonPath: "showChairsideInstallBanner", contextKey: "showChairsideInstallBanner" },
  ],
  build: () => ({ method: "GET", url: baseFor(), headers }),
};

export const featureHighlightsDismissDef: BlockDef = {
  kind: "featureHighlightsDismiss",
  label: "§3 Feature highlights — Dismiss (PUT)",
  auth: "cookie-or-jwt",
  inputs: [],
  outputs: [],
  build: () => ({
    method: "PUT",
    url: baseFor(),
    headers,
    body: { showChairsideInstallBanner: false },
  }),
};
