// src/blocks/dataBlock.ts
// Data-driven block format: JSON schema + interpreter that produces BlockDef.

import { z } from "zod";
import type { BlockDef, FieldSpec, HttpRequest } from "./types";
import { parsePathTokens, parseQueryEntries, parseBodyTokens, TOKEN_PATTERN } from "./urlTemplate";

// ---------------------------------------------------------------------------
// Zod sub-schemas mirroring existing TS types
// ---------------------------------------------------------------------------

const FieldTypeSchema = z.enum(["string", "password", "number", "enum", "json"]);

const FieldSpecSchema = z.object({
  name: z.string(),
  label: z.string(),
  type: FieldTypeSchema,
  required: z.boolean().optional(),
  fromContextKey: z.string().optional(),
  enumValues: z.array(z.string()).optional(),
  placeholder: z.string().optional(),
  location: z.enum(["path", "query", "body", "header"]).optional(),
});

const OutputSpecSchema = z.object({
  jsonPath: z.string(),
  contextKey: z.string(),
});

const AuthModeSchema = z.enum(["none", "jwt", "cookie-or-jwt"]);

// ---------------------------------------------------------------------------
// JsonTemplateValueSchema — recursive, allows any JSON value (template-aware)
// ---------------------------------------------------------------------------

type JsonTemplateValue =
  | string
  | number
  | boolean
  | null
  | JsonTemplateValue[]
  | { [key: string]: JsonTemplateValue };

const JsonTemplateValueSchema: z.ZodType<JsonTemplateValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(JsonTemplateValueSchema),
    z.record(z.string(), JsonTemplateValueSchema),
  ])
);

// ---------------------------------------------------------------------------
// BlockDefDataSchema
// ---------------------------------------------------------------------------

const RequestSchema = z.object({
  method: z.enum(["GET", "POST", "PUT", "DELETE"]),
  urlTemplate: z.string(),
  headers: z.record(z.string(), z.string()).optional(),
  query: z.record(z.string(), z.string()).optional(),
  bodyTemplate: JsonTemplateValueSchema.optional(),
});

export const BlockDefDataSchema = z.object({
  kind: z.string(),
  label: z.string(),
  auth: AuthModeSchema,
  inputs: z.array(FieldSpecSchema),
  outputs: z.array(OutputSpecSchema),
  request: RequestSchema,
});

export type BlockDefData = z.infer<typeof BlockDefDataSchema>;

// ---------------------------------------------------------------------------
// substituteTemplate
// ---------------------------------------------------------------------------

const WHOLE_TOKEN_RE = /^\{\{([^}]+)\}\}$/;
const INLINE_TOKEN_RE = /\{\{([^}]+)\}\}/g;

/**
 * Recursively substitute `{{name}}` tokens in a template value.
 *
 * - Whole-string token `"{{name}}"`: returns `values[name]` typed as-is
 *   (number stays number, etc.). If undefined, returns undefined.
 * - Inline token(s) in a string: replaced with `String(values[name] ?? "")`.
 * - Array: map items; drop any that resolved to undefined.
 * - Plain object: walk keys; omit keys whose resolved value is undefined.
 * - Primitives (number/boolean/null): returned as-is.
 */
export function substituteTemplate(
  template: unknown,
  values: Record<string, unknown>
): unknown {
  if (typeof template === "string") {
    // Whole-string token check
    const wholeMatch = WHOLE_TOKEN_RE.exec(template);
    if (wholeMatch) {
      return values[wholeMatch[1]];
    }
    // Inline substitution
    return template.replace(INLINE_TOKEN_RE, (_full, name: string) =>
      String(values[name] ?? "")
    );
  }

  if (Array.isArray(template)) {
    const result: unknown[] = [];
    for (const item of template) {
      const substituted = substituteTemplate(item, values);
      if (substituted !== undefined) {
        result.push(substituted);
      }
    }
    return result;
  }

  if (template !== null && typeof template === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(template as Record<string, unknown>)) {
      const substituted = substituteTemplate(val, values);
      if (substituted !== undefined) {
        result[key] = substituted;
      }
    }
    return result;
  }

  // number, boolean, null — pass through
  return template;
}

// ---------------------------------------------------------------------------
// dataDefToBlockDef
// ---------------------------------------------------------------------------

export function dataDefToBlockDef(
  data: BlockDefData,
  opts: { resolveBaseUrl: () => string }
): BlockDef {
  // Migrate old-format query record into the URL template
  let mergedUrl = data.request.urlTemplate;
  if (data.request.query && Object.keys(data.request.query).length > 0) {
    const queryStr = Object.entries(data.request.query)
      .map(([k, v]) => {
        const isToken = new RegExp(`^${TOKEN_PATTERN}$`).test(v);
        return `${encodeURIComponent(k)}=${isToken ? v : encodeURIComponent(v)}`;
      })
      .join("&");
    const sep = mergedUrl.includes("?") ? "&" : "?";
    mergedUrl = mergedUrl + sep + queryStr;
  }

  // Derive location for each input from where its token appears
  const pathSet = new Set(parsePathTokens(mergedUrl));
  const querySet = new Set(parseQueryEntries(mergedUrl).map((e) => e.token));
  const bodySet = new Set(
    data.request.bodyTemplate ? parseBodyTokens(data.request.bodyTemplate) : []
  );

  const inputs: FieldSpec[] = data.inputs.map((inp) => ({
    ...inp,
    location:
      inp.location ??
      (pathSet.has(inp.name)
        ? "path"
        : querySet.has(inp.name)
        ? "query"
        : bodySet.has(inp.name)
        ? "body"
        : undefined),
  }));

  function build(values: Record<string, unknown>): HttpRequest {
    // 1. Resolve path
    const pathPart = mergedUrl.split("?")[0];
    const resolvedPath = substituteTemplate(pathPart, values) as string;
    let url = `${opts.resolveBaseUrl()}${resolvedPath}`;

    // 2. Resolve query params from URL template (both token and static values)
    const qIdx = mergedUrl.indexOf("?");
    if (qIdx !== -1) {
      const queryPart = mergedUrl.slice(qIdx + 1);
      const params: string[] = [];
      for (const part of queryPart.split("&")) {
        const eqIdx = part.indexOf("=");
        if (eqIdx === -1) continue;
        const key = part.slice(0, eqIdx);
        const rawValue = part.slice(eqIdx + 1);
        if (!key) continue;
        const tokenMatch = new RegExp(`^${TOKEN_PATTERN}$`).exec(rawValue);
        let resolved: unknown;
        if (tokenMatch) {
          resolved = values[tokenMatch[1]];
        } else {
          resolved = rawValue;
        }
        if (resolved === undefined || resolved === "") continue;
        params.push(
          `${encodeURIComponent(key)}=${encodeURIComponent(String(resolved))}`
        );
      }
      if (params.length > 0) {
        url = `${url}?${params.join("&")}`;
      }
    }

    // 3. Resolve headers
    const headers: Record<string, string> = {};
    if (data.request.headers) {
      for (const [key, tpl] of Object.entries(data.request.headers)) {
        const resolved = substituteTemplate(tpl, values);
        if (resolved === undefined || resolved === "") continue;
        headers[key] = String(resolved);
      }
    }

    // 4. Resolve body
    if (data.request.bodyTemplate === undefined) {
      return { method: data.request.method, url, headers };
    }
    const body = substituteTemplate(data.request.bodyTemplate, values);
    if (body === undefined) {
      return { method: data.request.method, url, headers };
    }
    return { method: data.request.method, url, headers, body };
  }

  return {
    kind: data.kind,
    label: data.label,
    auth: data.auth,
    inputs,
    outputs: data.outputs,
    urlTemplate: mergedUrl,
    method: data.request.method,
    build,
  };
}
