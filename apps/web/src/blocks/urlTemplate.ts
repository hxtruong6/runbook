// src/blocks/urlTemplate.ts

export const TOKEN_PATTERN = "\\{\\{([^}]+)\\}\\}";

export function parsePathTokens(urlTemplate: string): string[] {
  const path = urlTemplate.split("?")[0];
  const tokens: string[] = [];
  const re = new RegExp(TOKEN_PATTERN, "g");
  let match: RegExpExecArray | null;
  while ((match = re.exec(path)) !== null) {
    if (!tokens.includes(match[1])) tokens.push(match[1]);
  }
  return tokens;
}

export function parseQueryEntries(urlTemplate: string): Array<{ key: string; token: string }> {
  const qIdx = urlTemplate.indexOf("?");
  const queryPart = qIdx === -1 ? "" : urlTemplate.slice(qIdx + 1);
  if (!queryPart) return [];
  const entries: Array<{ key: string; token: string }> = [];
  for (const part of queryPart.split("&")) {
    const eqIdx = part.indexOf("=");
    if (eqIdx === -1) continue;
    const key = part.slice(0, eqIdx);
    const value = part.slice(eqIdx + 1);
    const tokenMatch = /^\{\{([^}]+)\}\}$/.exec(value);
    if (tokenMatch && key) {
      entries.push({ key, token: tokenMatch[1] });
    }
  }
  return entries;
}

export function parseBodyTokens(bodyTemplate: unknown): string[] {
  const tokens: string[] = [];
  collectTokens(bodyTemplate, tokens);
  return tokens;
}

function collectTokens(value: unknown, out: string[], visited = new WeakSet()): void {
  if (typeof value === "string") {
    const re = new RegExp(TOKEN_PATTERN, "g");
    let match: RegExpExecArray | null;
    while ((match = re.exec(value)) !== null) {
      if (!out.includes(match[1])) out.push(match[1]);
    }
  } else if (Array.isArray(value)) {
    if (visited.has(value)) return;
    visited.add(value);
    for (const item of value) collectTokens(item, out, visited);
  } else if (value !== null && typeof value === "object") {
    if (visited.has(value as object)) return;
    visited.add(value as object);
    for (const v of Object.values(value as Record<string, unknown>)) collectTokens(v, out, visited);
  }
}

export function previewUrl(urlTemplate: string, values: Record<string, unknown>): string {
  return urlTemplate.replace(new RegExp(TOKEN_PATTERN, "g"), (_full, name: string) => {
    const v = values[name];
    return v !== undefined && v !== "" ? String(v) : `{{${name}}}`;
  });
}
