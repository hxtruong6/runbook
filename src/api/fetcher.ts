// src/api/fetcher.ts
import type { HttpRequest, AuthMode } from "../blocks/types";

export type RunRequestOptions = {
  auth: AuthMode;
  jwt?: string;
};

export type RunRequestResult = {
  httpStatus: number;
  body: unknown;
  elapsedMs: number;
};

export async function runRequest(
  req: HttpRequest,
  opts: RunRequestOptions
): Promise<RunRequestResult> {
  const headers: Record<string, string> = { ...req.headers };
  if ((opts.auth === "jwt" || opts.auth === "cookie-or-jwt") && opts.jwt) {
    headers["Authorization"] = `Bearer ${opts.jwt}`;
  }
  if (req.body !== undefined && !headers["content-type"] && !headers["Content-Type"]) {
    headers["content-type"] = "application/json";
  }

  const init: RequestInit = {
    method: req.method,
    headers,
    credentials: "include",
  };
  if (req.body !== undefined) {
    init.body = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
  }

  const started = performance.now();
  const res = await fetch(req.url, init);
  const elapsedMs = Math.round(performance.now() - started);

  const text = await res.text();
  let body: unknown = text;
  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  return { httpStatus: res.status, body, elapsedMs };
}
