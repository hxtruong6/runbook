import type { BlockDef, HttpRequest } from "./types";

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;

export const httpRequestDef: BlockDef = {
  kind: "httpRequest",
  label: "HTTP Request",
  auth: "none",
  inputs: [
    { name: "method", label: "Method", type: "enum", enumValues: [...METHODS], required: true },
    { name: "url", label: "URL", type: "string", required: true, placeholder: "https://example.com/api" },
    { name: "headers", label: "Headers (JSON)", type: "json", placeholder: '{"Content-Type": "application/json"}' },
    { name: "body", label: "Body (JSON)", type: "json", placeholder: '{"key": "value"}' },
  ],
  outputs: [
    { jsonPath: "status", contextKey: "lastStatus" },
    { jsonPath: "data", contextKey: "lastResponse" },
  ],
  build(values): HttpRequest {
    const rawMethod = String(values.method || "GET").toUpperCase();
    const method = (METHODS.includes(rawMethod as typeof METHODS[number]) ? rawMethod : "GET") as HttpRequest["method"];
    const url = String(values.url || "");
    let headers: Record<string, string> = {};
    if (values.headers) {
      try {
        headers = typeof values.headers === "string"
          ? JSON.parse(values.headers)
          : (values.headers as Record<string, string>);
      } catch {
        headers = {};
      }
    }
    const hasBody = method !== "GET" && method !== "DELETE" && values.body != null && values.body !== "";
    return { method, url, headers, body: hasBody ? values.body : undefined };
  },
};
