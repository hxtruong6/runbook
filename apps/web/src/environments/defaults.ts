// src/environments/defaults.ts
import type { Environment } from "./types";

export const DEFAULT_ENVIRONMENT: Environment = {
  id: "default-32co-alpha",
  name: "32CO alpha",
  baseUrl: "https://api-truong.32co.com",
  auth: { kind: "cookie" },
  headers: {},
  createdAt: "2026-05-12T00:00:00Z",
};
