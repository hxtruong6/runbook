import { describe, it, expect } from "vitest";
import {
  generateCurl,
  generateNodeFetch,
  generateAxios,
  redactSnippet,
  redactHeaders,
  formatRequestResponse,
} from "../../src/components/snippets";
import type { ResolvedRequest } from "../../src/blocks/types";

const GET_REQ: ResolvedRequest = {
  method: "GET",
  url: "https://api.example.com/users/123",
  headers: { Authorization: "Bearer realtoken", "Content-Type": "application/json" },
};

const POST_REQ: ResolvedRequest = {
  method: "POST",
  url: "https://api.example.com/users",
  headers: { Authorization: "Bearer realtoken", "Content-Type": "application/json" },
  body: { name: "Alice" },
};

describe("generateCurl", () => {
  it("includes method and url", () => {
    const out = generateCurl(GET_REQ);
    expect(out).toContain("curl -X GET");
    expect(out).toContain("https://api.example.com/users/123");
  });

  it("includes all headers as -H flags", () => {
    const out = generateCurl(GET_REQ);
    expect(out).toContain("-H 'Authorization: Bearer realtoken'");
    expect(out).toContain("-H 'Content-Type: application/json'");
  });

  it("omits --data for GET with no body", () => {
    expect(generateCurl(GET_REQ)).not.toContain("--data");
  });

  it("includes --data for POST with body", () => {
    const out = generateCurl(POST_REQ);
    expect(out).toContain("--data");
    expect(out).toContain("Alice");
  });
});

describe("generateNodeFetch", () => {
  it("includes url and method", () => {
    const out = generateNodeFetch(GET_REQ);
    expect(out).toContain("fetch('https://api.example.com/users/123'");
    expect(out).toContain("method: 'GET'");
  });

  it("includes real auth header value", () => {
    expect(generateNodeFetch(GET_REQ)).toContain("Bearer realtoken");
  });

  it("omits body for GET", () => {
    expect(generateNodeFetch(GET_REQ)).not.toContain("JSON.stringify");
  });

  it("includes JSON.stringify body for POST", () => {
    const out = generateNodeFetch(POST_REQ);
    expect(out).toContain("JSON.stringify");
    expect(out).toContain("Alice");
  });
});

describe("generateAxios", () => {
  it("uses axios.get for GET", () => {
    expect(generateAxios(GET_REQ)).toContain("axios.get(");
  });

  it("uses axios.post with body for POST", () => {
    const out = generateAxios(POST_REQ);
    expect(out).toContain("axios.post(");
    expect(out).toContain("Alice");
  });

  it("includes auth header value", () => {
    expect(generateAxios(GET_REQ)).toContain("Bearer realtoken");
  });
});

describe("generateCurl – shell injection safety", () => {
  it("escapes single quotes in header values", () => {
    const req: ResolvedRequest = {
      method: "GET",
      url: "https://api.example.com/",
      headers: { "Content-Type": "text/html; charset='utf-8'" },
    };
    const out = generateCurl(req);
    // The single quote must be escaped as '\'' so the shell string stays valid
    expect(out).toContain(`'Content-Type: text/html; charset='\\''utf-8'\\'''`);
    // Must not contain a bare unescaped single quote inside the header segment
    expect(out).not.toMatch(/-H 'Content-Type: text\/html; charset='[^\\]/);
  });

  it("escapes single quotes in the URL", () => {
    const req: ResolvedRequest = {
      method: "GET",
      url: "https://api.example.com/search?q=it's",
      headers: {},
    };
    const out = generateCurl(req);
    expect(out).toContain(`'https://api.example.com/search?q=it'\\''s'`);
  });
});

describe("generateNodeFetch – JS string safety", () => {
  it("escapes double quotes in header values", () => {
    const req: ResolvedRequest = {
      method: "GET",
      url: "https://api.example.com/",
      headers: { Accept: 'text/html, application/xhtml+xml, "application/xml"' },
    };
    const out = generateNodeFetch(req);
    // JSON.stringify will produce \"application/xml\" inside the string literal
    expect(out).toContain('\\"application/xml\\"');
    // The output must not contain a raw unescaped " inside a JS string value
    expect(out).not.toMatch(/"Accept": ".*"application\/xml".*"/);
  });
});

describe("generateAxios – JS string safety", () => {
  it("escapes double quotes in header values", () => {
    const req: ResolvedRequest = {
      method: "GET",
      url: "https://api.example.com/",
      headers: { Accept: 'text/html, application/xhtml+xml, "application/xml"' },
    };
    const out = generateAxios(req);
    expect(out).toContain('\\"application/xml\\"');
    expect(out).not.toMatch(/"Accept": ".*"application\/xml".*"/);
  });
});

describe("redactSnippet", () => {
  it("replaces real token value with YOUR_TOKEN", () => {
    const out = redactSnippet("Bearer realtoken", GET_REQ.headers);
    expect(out).toBe("Bearer YOUR_TOKEN");
    expect(out).not.toContain("realtoken");
  });

  it("leaves non-sensitive header values alone", () => {
    const snippet = "Content-Type: application/json";
    expect(redactSnippet(snippet, GET_REQ.headers)).toBe(snippet);
  });

  it("handles multiple occurrences", () => {
    const snippet = "realtoken realtoken";
    const out = redactSnippet(snippet, GET_REQ.headers);
    expect(out).toBe("YOUR_TOKEN YOUR_TOKEN");
  });
});

describe("redactHeaders", () => {
  it("replaces Authorization with ••••••••", () => {
    const out = redactHeaders(GET_REQ.headers);
    expect(out["Authorization"]).toBe("••••••••");
  });

  it("preserves non-sensitive headers", () => {
    const out = redactHeaders(GET_REQ.headers);
    expect(out["Content-Type"]).toBe("application/json");
  });

  it("is case-insensitive on header name", () => {
    const out = redactHeaders({ authorization: "secret" });
    expect(out["authorization"]).toBe("••••••••");
  });
});

describe("formatRequestResponse", () => {
  it("includes REQUEST and RESPONSE sections", () => {
    const out = formatRequestResponse(GET_REQ, {
      status: "ok",
      httpStatus: 200,
      elapsedMs: 123,
      response: { ok: true },
      captured: {},
    });
    expect(out).toContain("=== REQUEST ===");
    expect(out).toContain("GET https://api.example.com/users/123");
    expect(out).toContain("Authorization: Bearer realtoken");
    expect(out).toContain("=== RESPONSE ===");
    expect(out).toContain("HTTP 200");
    expect(out).toContain("123ms");
  });

  it("includes body in request section when present", () => {
    const out = formatRequestResponse(POST_REQ, {
      status: "ok",
      httpStatus: 201,
      elapsedMs: 50,
      response: null,
      captured: {},
    });
    expect(out).toContain("Alice");
  });
});
