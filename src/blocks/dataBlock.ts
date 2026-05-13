// src/blocks/dataBlock.ts
// Data-driven block format: JSON schema + interpreter that produces BlockDef.

import { z } from "zod";
import type { BlockDef, HttpRequest } from "./types";

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
  function build(values: Record<string, unknown>): HttpRequest {
    const { request } = data;

    // 1. Resolve URL
    const rawPath = substituteTemplate(request.urlTemplate, values) as string;
    let url = `${opts.resolveBaseUrl()}${rawPath}`;

    // 2. Resolve query params; append to URL
    if (request.query) {
      const params: string[] = [];
      for (const [key, tpl] of Object.entries(request.query)) {
        const resolved = substituteTemplate(tpl, values);
        if (resolved === undefined || resolved === "") {
          continue;
        }
        params.push(
          `${encodeURIComponent(key)}=${encodeURIComponent(String(resolved))}`
        );
      }
      if (params.length > 0) {
        const sep = url.includes("?") ? "&" : "?";
        url = `${url}${sep}${params.join("&")}`;
      }
    }

    // 3. Resolve headers; drop ones that became undefined or ""
    const headers: Record<string, string> = {};
    if (request.headers) {
      for (const [key, tpl] of Object.entries(request.headers)) {
        const resolved = substituteTemplate(tpl, values);
        if (resolved === undefined || resolved === "") {
          continue;
        }
        headers[key] = String(resolved);
      }
    }

    // 4. Resolve body
    if (request.bodyTemplate === undefined) {
      return { method: request.method, url, headers };
    }

    const body = substituteTemplate(request.bodyTemplate, values);
    if (body === undefined) {
      return { method: request.method, url, headers };
    }

    return { method: request.method, url, headers, body };
  }

  return {
    kind: data.kind,
    label: data.label,
    auth: data.auth,
    inputs: data.inputs,
    outputs: data.outputs,
    build,
  };
}
