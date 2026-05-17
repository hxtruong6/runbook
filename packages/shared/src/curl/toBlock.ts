// packages/shared/src/curl/toBlock.ts
// Maps a ParsedCurl result onto a BlockDefData-style data shape.
// BlockDefData is the JSON schema format consumed by dataDefToBlockDef in the
// web app. We mirror that shape here so the shared package has no dependency
// on the web-side Zod schema.

import type { ParsedCurl } from "./parseCurl.js";

// ---------------------------------------------------------------------------
// Subset of BlockDefData we care about
// ---------------------------------------------------------------------------

export type CurlBlockData = {
  kind: string;
  label: string;
  auth: "none" | "jwt" | "cookie-or-jwt";
  inputs: Array<{
    name: string;
    label: string;
    type: "string" | "password" | "number" | "enum" | "json";
    required?: boolean;
    placeholder?: string;
    location?: "path" | "query" | "body" | "header";
  }>;
  outputs: Array<{
    jsonPath: string;
    contextKey: string;
  }>;
  request: {
    method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
    urlTemplate: string;
    headers?: Record<string, string>;
    bodyTemplate?: unknown;
  };
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function labelFromUrl(url: string): string {
  try {
    const u = new URL(url);
    // e.g. "GET api.stripe.com/v1/customers"
    const path = u.pathname.replace(/^\//, "").replace(/\/$/, "") || u.hostname;
    return path.length > 40 ? path.slice(0, 40) + "…" : path;
  } catch {
    return url.slice(0, 40);
  }
}

function normalizeMethod(
  m: string
): "GET" | "POST" | "PUT" | "DELETE" | "PATCH" {
  const upper = m.toUpperCase();
  if (
    upper === "GET" ||
    upper === "POST" ||
    upper === "PUT" ||
    upper === "DELETE" ||
    upper === "PATCH"
  ) {
    return upper;
  }
  return "GET";
}

/**
 * Attempt to parse a JSON body. Returns the parsed object/array if possible,
 * otherwise returns the raw string (for form-encoded bodies, etc.).
 */
function parseBody(body: string): unknown {
  const trimmed = body.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      return JSON.parse(trimmed) as unknown;
    } catch {
      // fall through
    }
  }
  return trimmed;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Convert a ParsedCurl into a CurlBlockData (BlockDefData-compatible shape).
 *
 * @param parsed   Result of parseCurl()
 * @param kindSuffix  Optional suffix appended to the generated `kind` to make
 *                    it unique (defaults to a short timestamp fragment).
 */
export function toBlock(
  parsed: ParsedCurl,
  kindSuffix?: string
): CurlBlockData {
  const method = normalizeMethod(parsed.method);
  const rawLabel = labelFromUrl(parsed.url);
  const suffix = kindSuffix ?? Date.now().toString(36);
  const kind = slugify(`${method}-${rawLabel}`) + "-" + suffix;
  const label = `${method} ${rawLabel}`;

  // Build headers record for the request, excluding Authorization if -u was
  // the source (we keep auth in the block's auth field instead).
  const requestHeaders: Record<string, string> = {};
  for (const [k, v] of Object.entries(parsed.headers)) {
    requestHeaders[k] = v;
  }

  // Resolve bodyTemplate
  let bodyTemplate: unknown;
  if (parsed.body !== undefined) {
    bodyTemplate = parseBody(parsed.body);
  }

  // Build inputs list
  const inputs: CurlBlockData["inputs"] = [];

  // Always expose url and method as overridable inputs
  inputs.push({
    name: "url",
    label: "URL",
    type: "string",
    required: true,
    placeholder: parsed.url,
  });
  inputs.push({
    name: "method",
    label: "Method",
    type: "enum",
    required: true,
  });

  // If there are headers, expose them as a JSON input
  if (Object.keys(requestHeaders).length > 0) {
    inputs.push({
      name: "headers",
      label: "Headers (JSON)",
      type: "json",
      location: "header",
    });
  }

  // Body input
  if (parsed.body !== undefined) {
    inputs.push({
      name: "body",
      label: "Body",
      type: "json",
      location: "body",
    });
  }

  // Auth indicator
  const authMode: CurlBlockData["auth"] = "none";

  return {
    kind,
    label,
    auth: authMode,
    inputs,
    outputs: [
      { jsonPath: "data", contextKey: "lastResponse" },
      { jsonPath: "status", contextKey: "lastStatus" },
    ],
    request: {
      method,
      urlTemplate: parsed.url,
      ...(Object.keys(requestHeaders).length > 0
        ? { headers: requestHeaders }
        : {}),
      ...(bodyTemplate !== undefined ? { bodyTemplate } : {}),
    },
  };
}
