import { DEFAULT_ENVIRONMENT } from "../environments/defaults";
import { getActiveEnvironment } from "../environments/storage";

// Kept for backwards compat — block build() functions use this until F2-T4.
export const API_BASE_URL: string = DEFAULT_ENVIRONMENT.baseUrl;

/** Returns the active environment's base URL, or DEFAULT_ENVIRONMENT.baseUrl as fallback. */
export function getBaseUrl(): string {
  const active = getActiveEnvironment();
  return active?.baseUrl ?? DEFAULT_ENVIRONMENT.baseUrl;
}
