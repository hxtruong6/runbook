import type { Scenario } from "./types";

const t = "2026-05-12T00:00:00Z";

export const PREBUILT_SCENARIOS: Scenario[] = [
  {
    id: "prebuilt-happy-path",
    name: "Chairside happy path",
    createdAt: t,
    blocks: [
      { id: "b1", kind: "signin", overrides: { email: "truong.hoang+chairside-p001@32co.com", password: "P@ss123456_" } },
      { id: "b2", kind: "profile", overrides: {} },
      { id: "b3", kind: "startChairside", overrides: { firstName: "Test", lastName: "Patient" } },
      { id: "b4", kind: "uploadPhoto", overrides: { slot: "chairside-full-face", url: "https://example.com/full-face.jpg" } },
      { id: "b5", kind: "uploadPhoto", overrides: { slot: "chairside-close-up", url: "https://example.com/close-up.jpg" } },
      { id: "b6", kind: "uploadPhoto", overrides: { slot: "chairside-upper-arch", url: "https://example.com/upper.jpg" } },
      { id: "b7", kind: "uploadPhoto", overrides: { slot: "chairside-lower-arch", url: "https://example.com/lower.jpg" } },
      { id: "b8", kind: "getOrthoReview", overrides: {} },
      { id: "b9", kind: "updateChairsideStatus", overrides: { chairsideStatus: "COMPLETED" } },
    ],
  },
  {
    id: "prebuilt-phone-first-pair",
    name: "Phone first-pair",
    createdAt: t,
    blocks: [
      { id: "b1", kind: "verifyDeviceToken", overrides: { orthoReviewChairsideToken: "0e0ee405c57b90f97c7cd330380e9730" } },
    ],
  },
  {
    id: "prebuilt-dismiss-banner",
    name: "Dismiss install banner",
    createdAt: t,
    blocks: [
      { id: "b1", kind: "signin", overrides: { email: "truong.hoang+chairside-p001@32co.com", password: "P@ss123456_" } },
      { id: "b2", kind: "featureHighlightsGet", overrides: {} },
      { id: "b3", kind: "featureHighlightsDismiss", overrides: {} },
    ],
  },
  {
    id: "prebuilt-realtime-sanity",
    name: "Realtime sanity",
    createdAt: t,
    blocks: [
      { id: "b1", kind: "signin", overrides: { email: "truong.hoang+chairside-p001@32co.com", password: "P@ss123456_" } },
      { id: "b2", kind: "startChairside", overrides: { firstName: "Test", lastName: "Realtime" } },
      { id: "b3", kind: "socketConnect", overrides: { role: "DENTIST" } },
      { id: "b4", kind: "uploadPhoto", overrides: { slot: "chairside-full-face", url: "https://example.com/full.jpg" } },
      { id: "b5", kind: "updateChairsideStatus", overrides: { chairsideStatus: "COMPLETED" } },
    ],
  },
];
