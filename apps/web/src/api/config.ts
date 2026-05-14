import { getActiveEnvironment } from "../environments/storage";

export const API_BASE_URL: string = "";

export function getBaseUrl(): string {
  const active = getActiveEnvironment();
  return active?.baseUrl ?? "";
}
