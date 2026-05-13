import type { ResolvedRequest, BlockRunResult } from "../blocks/types";

const SENSITIVE = new Set(["authorization", "cookie", "x-api-key", "x-auth-token"]);

export function redactHeaders(headers: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(headers).map(([k, v]) => [
      k,
      SENSITIVE.has(k.toLowerCase()) ? "••••••••" : v,
    ])
  );
}

export function redactSnippet(snippet: string, headers: Record<string, string>): string {
  let out = snippet;
  for (const [k, v] of Object.entries(headers)) {
    if (SENSITIVE.has(k.toLowerCase()) && v) {
      // Replace both the full value and any credential portion after a scheme prefix
      // e.g. "Bearer realtoken" → replace "realtoken" (the credential part)
      const parts = v.split(" ");
      const credential = parts.length > 1 ? parts[parts.length - 1] : v;
      out = out.split(credential).join("YOUR_TOKEN");
    }
  }
  return out;
}

function escapeSh(s: string): string {
  return s.replace(/'/g, "'\\''");
}

export function generateCurl(req: ResolvedRequest): string {
  const headerFlags = Object.entries(req.headers)
    .map(([k, v]) => `  -H '${k}: ${escapeSh(v)}'`)
    .join(" \\\n");
  const body = req.body !== undefined ? JSON.stringify(req.body) : undefined;
  const bodyFlag = body !== undefined ? ` \\\n  --data '${escapeSh(body)}'` : "";
  return `curl -X ${req.method} '${escapeSh(req.url)}' \\\n${headerFlags}${bodyFlag}`;
}

export function generateNodeFetch(req: ResolvedRequest): string {
  const headersLines = Object.entries(req.headers)
    .map(([k, v]) => `    ${JSON.stringify(k)}: ${JSON.stringify(v)}`)
    .join(",\n");
  const bodyLine =
    req.body !== undefined
      ? `\n  body: JSON.stringify(${JSON.stringify(req.body, null, 2)}),`
      : "";
  return (
    `const res = await fetch('${req.url}', {\n` +
    `  method: '${req.method}',\n` +
    `  headers: {\n${headersLines}\n  },${bodyLine}\n` +
    `});\nconst data = await res.json();`
  );
}

export function generateAxios(req: ResolvedRequest): string {
  const method = req.method.toLowerCase();
  const headersLines = Object.entries(req.headers)
    .map(([k, v]) => `    ${JSON.stringify(k)}: ${JSON.stringify(v)}`)
    .join(",\n");
  const config = `{\n  headers: {\n${headersLines}\n  },\n}`;
  if (req.body !== undefined) {
    return `const { data } = await axios.${method}('${req.url}', ${JSON.stringify(req.body, null, 2)}, ${config});`;
  }
  return `const { data } = await axios.${method}('${req.url}', ${config});`;
}

export function formatRequestResponse(req: ResolvedRequest, result: BlockRunResult): string {
  const headerLines = Object.entries(req.headers)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
  const bodySection =
    req.body !== undefined ? `\n\n${JSON.stringify(req.body, null, 2)}` : "";
  const responseBody =
    typeof result.response === "string"
      ? result.response
      : JSON.stringify(result.response, null, 2);
  const code =
    "httpStatus" in result && result.httpStatus ? result.httpStatus : "—";
  return (
    `=== REQUEST ===\n${req.method} ${req.url}\n${headerLines}${bodySection}\n\n` +
    `=== RESPONSE ===\nHTTP ${code}  (${result.elapsedMs}ms)\n${responseBody}`
  );
}
