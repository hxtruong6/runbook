// tests/curl/parseCurl.test.ts
import { describe, it, expect } from "vitest";
import { parseCurl, tokenize } from "../../src/curl/parseCurl.js";

// ---------------------------------------------------------------------------
// tokenize
// ---------------------------------------------------------------------------

describe("tokenize", () => {
  it("splits plain tokens by whitespace", () => {
    expect(tokenize("curl -X POST https://example.com")).toEqual([
      "curl", "-X", "POST", "https://example.com",
    ]);
  });

  it("preserves single-quoted string as one token", () => {
    expect(tokenize("curl -d 'hello world'")).toEqual(["curl", "-d", "hello world"]);
  });

  it("preserves double-quoted string as one token", () => {
    expect(tokenize('curl -H "Content-Type: application/json"')).toEqual([
      "curl", "-H", "Content-Type: application/json",
    ]);
  });

  it("handles escaped double-quote inside double-quoted string", () => {
    expect(tokenize('curl -d "{\\"key\\":\\"value\\"}"')).toEqual([
      "curl", "-d", '{"key":"value"}',
    ]);
  });

  it("handles empty single-quoted token", () => {
    expect(tokenize("curl -d ''")).toEqual(["curl", "-d", ""]);
  });
});

// ---------------------------------------------------------------------------
// parseCurl — basic GET
// ---------------------------------------------------------------------------

describe("parseCurl — GET requests", () => {
  it("parses a bare URL with no flags (defaults to GET)", () => {
    const r = parseCurl("curl https://api.example.com/v1/users");
    expect(r).not.toBeNull();
    expect(r!.method).toBe("GET");
    expect(r!.url).toBe("https://api.example.com/v1/users");
    expect(r!.headers).toEqual({});
    expect(r!.body).toBeUndefined();
  });

  it("parses explicit -X GET", () => {
    const r = parseCurl("curl -X GET https://api.example.com/data");
    expect(r!.method).toBe("GET");
  });

  it("parses --request GET", () => {
    const r = parseCurl("curl --request GET https://api.example.com/data");
    expect(r!.method).toBe("GET");
  });

  it("returns null for empty string", () => {
    expect(parseCurl("")).toBeNull();
  });

  it("returns null when no URL is present", () => {
    expect(parseCurl("curl -X POST -H 'Accept: application/json'")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// parseCurl — Headers
// ---------------------------------------------------------------------------

describe("parseCurl — headers", () => {
  it("parses -H with double quotes", () => {
    const r = parseCurl('curl -H "Authorization: Bearer tok123" https://api.github.com/user');
    expect(r!.headers["Authorization"]).toBe("Bearer tok123");
  });

  it("parses -H with single quotes", () => {
    const r = parseCurl("curl -H 'Content-Type: application/json' https://api.example.com");
    expect(r!.headers["Content-Type"]).toBe("application/json");
  });

  it("parses multiple headers", () => {
    const r = parseCurl(
      'curl -H "Authorization: Bearer X" -H "Accept: application/json" https://api.github.com/user/repos'
    );
    expect(r!.headers["Authorization"]).toBe("Bearer X");
    expect(r!.headers["Accept"]).toBe("application/json");
  });

  it("parses --header long form", () => {
    const r = parseCurl('curl --header "X-Custom: value" https://example.com');
    expect(r!.headers["X-Custom"]).toBe("value");
  });
});

// ---------------------------------------------------------------------------
// parseCurl — Body / POST
// ---------------------------------------------------------------------------

describe("parseCurl — body flags", () => {
  it("infers POST when -d is present but no -X given", () => {
    const r = parseCurl("curl -d '{\"a\":1}' https://api.example.com/endpoint");
    expect(r!.method).toBe("POST");
  });

  it("parses -d body", () => {
    const r = parseCurl('curl -X POST https://api.example.com -d \'{"key":"value"}\'');
    expect(r!.body).toBe('{"key":"value"}');
  });

  it("parses --data body", () => {
    const r = parseCurl('curl --data \'{"x":1}\' https://api.example.com');
    expect(r!.body).toBe('{"x":1}');
  });

  it("parses --data-raw body", () => {
    const r = parseCurl('curl --data-raw \'{"raw":true}\' https://api.example.com');
    expect(r!.body).toBe('{"raw":true}');
  });

  it("parses --data-binary body", () => {
    const r = parseCurl('curl --data-binary \'binarydata\' https://api.example.com');
    expect(r!.body).toBe("binarydata");
  });
});

// ---------------------------------------------------------------------------
// parseCurl — Stripe pattern (-u user:)
// ---------------------------------------------------------------------------

describe("parseCurl — basic auth (-u / --user)", () => {
  it("parses Stripe-style -u sk_test_xxx: (empty password)", () => {
    const r = parseCurl("curl https://api.stripe.com/v1/customers -u sk_test_abc123:");
    expect(r!.url).toBe("https://api.stripe.com/v1/customers");
    expect(r!.auth).toEqual({ user: "sk_test_abc123", password: "" });
    expect(r!.headers["Authorization"]).toMatch(/^Basic /);
  });

  it("parses -u user:pass and sets Authorization header", () => {
    const r = parseCurl("curl -u admin:secret https://api.example.com/protected");
    expect(r!.auth).toEqual({ user: "admin", password: "secret" });
    expect(r!.headers["Authorization"]).toMatch(/^Basic /);
  });

  it("does not override existing Authorization header with -u", () => {
    const r = parseCurl(
      'curl -u user:pass -H "Authorization: Bearer existing" https://api.example.com'
    );
    expect(r!.headers["Authorization"]).toBe("Bearer existing");
    expect(r!.auth).toEqual({ user: "user", password: "pass" });
  });
});

// ---------------------------------------------------------------------------
// parseCurl — OpenAI POST with JSON body (real-world)
// ---------------------------------------------------------------------------

describe("parseCurl — OpenAI POST", () => {
  const curlCmd = `curl https://api.openai.com/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-proj-xxx" \
  -d '{"model":"gpt-4o","messages":[{"role":"user","content":"Hello!"}]}'`;

  it("parses OpenAI chat completions curl", () => {
    const r = parseCurl(curlCmd);
    expect(r!.method).toBe("POST");
    expect(r!.url).toBe("https://api.openai.com/v1/chat/completions");
    expect(r!.headers["Content-Type"]).toBe("application/json");
    expect(r!.headers["Authorization"]).toBe("Bearer sk-proj-xxx");
    expect(r!.body).toBe('{"model":"gpt-4o","messages":[{"role":"user","content":"Hello!"}]}');
  });
});

// ---------------------------------------------------------------------------
// parseCurl — GitHub (real-world)
// ---------------------------------------------------------------------------

describe("parseCurl — GitHub", () => {
  it("parses GitHub API with Bearer token", () => {
    const r = parseCurl('curl -H "Authorization: Bearer ghp_xxx" https://api.github.com/user/repos');
    expect(r!.method).toBe("GET");
    expect(r!.url).toBe("https://api.github.com/user/repos");
    expect(r!.headers["Authorization"]).toBe("Bearer ghp_xxx");
  });
});

// ---------------------------------------------------------------------------
// parseCurl — multi-line backslash continuation
// ---------------------------------------------------------------------------

describe("parseCurl — line continuation", () => {
  it("handles backslash + newline continuations", () => {
    const cmd = [
      "curl -X POST \\",
      "  https://api.openai.com/v1/completions \\",
      "  -H 'Content-Type: application/json' \\",
      "  -H 'Authorization: Bearer sk-test' \\",
      "  -d '{\"prompt\":\"hi\"}'",
    ].join("\n");

    const r = parseCurl(cmd);
    expect(r!.method).toBe("POST");
    expect(r!.url).toBe("https://api.openai.com/v1/completions");
    expect(r!.headers["Content-Type"]).toBe("application/json");
    expect(r!.headers["Authorization"]).toBe("Bearer sk-test");
    expect(r!.body).toBe('{"prompt":"hi"}');
  });

  it("handles Windows-style \\r\\n continuations", () => {
    const cmd = "curl -X GET \\\r\n  https://api.example.com";
    const r = parseCurl(cmd);
    expect(r!.method).toBe("GET");
    expect(r!.url).toBe("https://api.example.com");
  });
});

// ---------------------------------------------------------------------------
// parseCurl — --url flag
// ---------------------------------------------------------------------------

describe("parseCurl — --url flag", () => {
  it("uses --url as the URL source", () => {
    const r = parseCurl("curl --url https://api.example.com/items -X DELETE");
    expect(r!.url).toBe("https://api.example.com/items");
    expect(r!.method).toBe("DELETE");
  });
});

// ---------------------------------------------------------------------------
// parseCurl — silent / verbose flags (ignored gracefully)
// ---------------------------------------------------------------------------

describe("parseCurl — ignored flags", () => {
  it("ignores -L (follow redirects) without error", () => {
    const r = parseCurl("curl -L https://bit.ly/shortlink");
    expect(r!.url).toBe("https://bit.ly/shortlink");
  });

  it("ignores -s and -v flags", () => {
    const r = parseCurl("curl -s -v https://api.example.com");
    expect(r!.url).toBe("https://api.example.com");
  });

  it("ignores -o (output file flag)", () => {
    const r = parseCurl("curl -o /tmp/out.json https://api.example.com");
    expect(r!.url).toBe("https://api.example.com");
  });
});

// ---------------------------------------------------------------------------
// parseCurl — PUT / PATCH / DELETE
// ---------------------------------------------------------------------------

describe("parseCurl — other HTTP methods", () => {
  it("parses PUT request", () => {
    const r = parseCurl('curl -X PUT https://api.example.com/users/1 -d \'{"name":"Bob"}\'');
    expect(r!.method).toBe("PUT");
    expect(r!.url).toBe("https://api.example.com/users/1");
  });

  it("parses DELETE request", () => {
    const r = parseCurl("curl -X DELETE https://api.example.com/users/1");
    expect(r!.method).toBe("DELETE");
  });
});
