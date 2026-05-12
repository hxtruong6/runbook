import type { BlockDef } from "./types";
import { API_BASE_URL } from "../api/config";

const BASE = `${API_BASE_URL}/v1/aligner/dentist/feature-highlights`;
const headers = { accept: "application/json", "x-client-version": "0.4.0" };

export const featureHighlightsGetDef: BlockDef = {
  kind: "featureHighlightsGet",
  label: "§2 Feature highlights — GET",
  auth: "cookie-or-jwt",
  inputs: [],
  outputs: [
    { jsonPath: "showChairsideInstallBanner", contextKey: "showChairsideInstallBanner" },
  ],
  build: () => ({ method: "GET", url: BASE, headers }),
};

export const featureHighlightsDismissDef: BlockDef = {
  kind: "featureHighlightsDismiss",
  label: "§3 Feature highlights — Dismiss (PUT)",
  auth: "cookie-or-jwt",
  inputs: [],
  outputs: [],
  build: () => ({
    method: "PUT",
    url: BASE,
    headers,
    body: { showChairsideInstallBanner: false },
  }),
};
