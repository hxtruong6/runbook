// packages/shared/src/curl/parseCurl.ts
// Robust cURL command parser.
//
// Supported flags:
//   -X / --request      HTTP method
//   -H / --header       request header (repeatable)
//   -d / --data / --data-raw / --data-binary   request body
//   -u / --user         basic-auth credentials (user:pass)
//   --url               explicit URL (alternative to positional)
//   Line continuations: trailing backslash + newline collapsed to space.
//   Single + double quotes, escaped quotes inside double-quoted strings.

export type ParsedCurl = {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: string;
  auth?: { user: string; password: string };
};

// ---------------------------------------------------------------------------
// Tokenizer
// ---------------------------------------------------------------------------

/**
 * Tokenize a normalized (no line-continuation) cURL string into an array of
 * argv-style tokens, respecting single and double quoting and backslash escapes.
 */
export function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  const len = input.length;

  while (i < len) {
    // Skip whitespace
    while (i < len && /\s/.test(input[i]!)) i++;
    if (i >= len) break;

    let token = "";
    const ch = input[i]!;

    if (ch === "'") {
      // Single-quoted: no escape processing inside
      i++; // skip opening quote
      while (i < len && input[i] !== "'") {
        token += input[i++];
      }
      i++; // skip closing quote
    } else if (ch === '"') {
      // Double-quoted: process backslash escapes
      i++; // skip opening quote
      while (i < len && input[i] !== '"') {
        if (input[i] === '\\' && i + 1 < len) {
          const next = input[i + 1]!;
          // Common escapes inside double quotes
          if (next === '"' || next === '\\' || next === '$' || next === '`' || next === '\n') {
            token += next;
            i += 2;
          } else {
            token += '\\';
            i++;
          }
        } else {
          token += input[i++];
        }
      }
      i++; // skip closing quote
    } else {
      // Unquoted: read until whitespace; handle inline quotes and backslashes
      while (i < len && !/\s/.test(input[i]!)) {
        const c = input[i]!;
        if (c === '\\' && i + 1 < len) {
          token += input[i + 1]!;
          i += 2;
        } else if (c === "'") {
          i++;
          while (i < len && input[i] !== "'") token += input[i++];
          i++; // closing quote
        } else if (c === '"') {
          i++;
          while (i < len && input[i] !== '"') {
            if (input[i] === '\\' && i + 1 < len) {
              token += input[i + 1]!;
              i += 2;
            } else {
              token += input[i++];
            }
          }
          i++; // closing quote
        } else {
          token += c;
          i++;
        }
      }
    }

    if (token.length > 0 || ch === "'" || ch === '"') {
      tokens.push(token);
    }
  }

  return tokens;
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

export function parseCurl(raw: string): ParsedCurl | null {
  // Collapse line continuations (backslash + newline → space)
  const normalized = raw.replace(/\\\r?\n/g, " ").trim();

  const tokens = tokenize(normalized);
  if (tokens.length === 0) return null;

  // The first token should be "curl"
  let idx = 0;
  if (tokens[idx]?.toLowerCase() === "curl") idx++;

  let method: string | undefined;
  let url: string | undefined;
  const headers: Record<string, string> = {};
  let body: string | undefined;
  let auth: { user: string; password: string } | undefined;

  while (idx < tokens.length) {
    const tok = tokens[idx]!;

    // ------ Method ------
    if (tok === "-X" || tok === "--request") {
      idx++;
      if (idx < tokens.length) method = tokens[idx++]!.toUpperCase();
      continue;
    }

    // ------ Headers ------
    if (tok === "-H" || tok === "--header") {
      idx++;
      if (idx < tokens.length) {
        const header = tokens[idx++]!;
        const colonIdx = header.indexOf(":");
        if (colonIdx !== -1) {
          const name = header.slice(0, colonIdx).trim();
          const value = header.slice(colonIdx + 1).trim();
          headers[name] = value;
        }
      }
      continue;
    }

    // ------ Body ------
    if (
      tok === "-d" ||
      tok === "--data" ||
      tok === "--data-raw" ||
      tok === "--data-binary" ||
      tok === "--data-urlencode"
    ) {
      idx++;
      if (idx < tokens.length) body = tokens[idx++]!;
      continue;
    }

    // ------ Basic auth (-u / --user) ------
    if (tok === "-u" || tok === "--user") {
      idx++;
      if (idx < tokens.length) {
        const userpass = tokens[idx++]!;
        const colonIdx = userpass.indexOf(":");
        if (colonIdx !== -1) {
          auth = {
            user: userpass.slice(0, colonIdx),
            password: userpass.slice(colonIdx + 1),
          };
        } else {
          auth = { user: userpass, password: "" };
        }
      }
      continue;
    }

    // ------ Explicit URL ------
    if (tok === "--url") {
      idx++;
      if (idx < tokens.length) url = tokens[idx++]!;
      continue;
    }

    // ------ Location (-L) and other single-flag options (no value) ------
    if (
      tok === "-L" ||
      tok === "--location" ||
      tok === "-s" ||
      tok === "--silent" ||
      tok === "-v" ||
      tok === "--verbose" ||
      tok === "-i" ||
      tok === "--include" ||
      tok === "-k" ||
      tok === "--insecure" ||
      tok === "-g" ||
      tok === "--globoff" ||
      tok === "--compressed" ||
      tok === "--no-buffer"
    ) {
      idx++;
      continue;
    }

    // ------ Flags that take a value but we don't use ------
    if (
      tok === "-o" || tok === "--output" ||
      tok === "-A" || tok === "--user-agent" ||
      tok === "--max-time" || tok === "-m" ||
      tok === "--connect-timeout" ||
      tok === "--proxy" || tok === "-x" ||
      tok === "--cacert" ||
      tok === "--cert" ||
      tok === "--key" ||
      tok === "-e" || tok === "--referer" ||
      tok === "-b" || tok === "--cookie" ||
      tok === "-c" || tok === "--cookie-jar" ||
      tok === "--form" || tok === "-F" ||
      tok === "--oauth2-bearer"
    ) {
      idx += 2; // skip flag + value
      continue;
    }

    // ------ Positional URL ------
    if (!tok.startsWith("-") && url === undefined) {
      url = tok;
      idx++;
      continue;
    }

    // Unknown flag — skip
    idx++;
  }

  if (!url) return null;

  // Default method: POST when body present, GET otherwise
  if (!method) method = body !== undefined ? "POST" : "GET";

  // When -u is provided, set Authorization header (Basic) unless already set
  if (auth && !headers["Authorization"]) {
    const encoded =
      typeof btoa !== "undefined"
        ? btoa(`${auth.user}:${auth.password}`)
        : (globalThis as { Buffer?: { from(s: string): { toString(enc: string): string } } }).Buffer!
            .from(`${auth.user}:${auth.password}`)
            .toString("base64");
    headers["Authorization"] = `Basic ${encoded}`;
  }

  return { method, url, headers, body, auth };
}
