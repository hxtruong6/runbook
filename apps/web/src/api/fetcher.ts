// src/api/fetcher.ts
import type { HttpRequest, AuthMode, ResolvedRequest } from "../blocks/types";
import type { AuthConfig } from "../environments/types";

export type RunRequestOptions = {
  auth: AuthMode;
  jwt?: string;
  envAuth?: AuthConfig;
  envHeaders?: Record<string, string>;
};

export type RunRequestResult = {
  httpStatus: number;
  body: unknown;
  elapsedMs: number;
  resolvedRequest: ResolvedRequest;
};

export async function runRequest(
  req: HttpRequest,
  opts: RunRequestOptions
): Promise<RunRequestResult> {
  // Start with env-level custom headers (always merged, even for auth=none)
  const headers: Record<string, string> = {
    ...(opts.envHeaders ?? {}),
    ...req.headers,
  };

  let url = req.url;

  // Apply envAuth only when block is NOT "none"
  if (opts.auth !== "none" && opts.envAuth) {
    const envAuth = opts.envAuth;
    switch (envAuth.kind) {
      case "bearer":
        // opts.jwt (in-session captured token) wins when present
        if (!opts.jwt) {
          headers["Authorization"] = `Bearer ${envAuth.token}`;
        }
        break;
      case "cookie":
        // credentials: "include" is already set below; bearer header only if token present
        if (envAuth.token && !opts.jwt) {
          headers["Authorization"] = `Bearer ${envAuth.token}`;
        }
        break;
      case "apiKey":
        if (envAuth.in === "header") {
          headers[envAuth.name] = envAuth.value;
        } else {
          // query — preserve existing query string
          const sep = url.includes("?") ? "&" : "?";
          url = `${url}${sep}${encodeURIComponent(envAuth.name)}=${encodeURIComponent(envAuth.value)}`;
        }
        break;
      case "basic":
        headers["Authorization"] = `Basic ${btoa(`${envAuth.username}:${envAuth.password}`)}`;
        break;
      case "none":
        break;
    }
  }

  // In-session JWT (from signin capture) — always wins for bearer, set regardless of envAuth
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
  const res = await fetch(url, init);
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

  return {
    httpStatus: res.status,
    body,
    elapsedMs,
    resolvedRequest: { method: req.method, url, headers, body: req.body },
  };
}
