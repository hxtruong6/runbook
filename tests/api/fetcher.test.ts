// tests/api/fetcher.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { runRequest } from "../../src/api/fetcher";

describe("runRequest", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends Authorization: Bearer when jwt is provided", async () => {
    (global.fetch as any).mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } })
    );
    await runRequest(
      { method: "GET", url: "https://api.example/x", headers: {} },
      { auth: "jwt", jwt: "abc123" }
    );
    const [, init] = (global.fetch as any).mock.calls[0];
    expect(init.headers["Authorization"]).toBe("Bearer abc123");
    expect(init.credentials).toBe("include");
  });

  it("omits Authorization when jwt is missing and auth is cookie-or-jwt", async () => {
    (global.fetch as any).mockResolvedValue(
      new Response("{}", { status: 200, headers: { "content-type": "application/json" } })
    );
    await runRequest(
      { method: "GET", url: "https://api.example/x", headers: {} },
      { auth: "cookie-or-jwt" }
    );
    const [, init] = (global.fetch as any).mock.calls[0];
    expect(init.headers["Authorization"]).toBeUndefined();
    expect(init.credentials).toBe("include");
  });

  it("returns httpStatus, elapsed, and parsed JSON body", async () => {
    (global.fetch as any).mockResolvedValue(
      new Response(JSON.stringify({ hello: "world" }), { status: 201, headers: { "content-type": "application/json" } })
    );
    const result = await runRequest(
      { method: "POST", url: "https://api.example/x", headers: {}, body: { a: 1 } },
      { auth: "none" }
    );
    expect(result.httpStatus).toBe(201);
    expect(result.body).toEqual({ hello: "world" });
    expect(typeof result.elapsedMs).toBe("number");
  });

  it("falls back to raw text when response is not JSON", async () => {
    (global.fetch as any).mockResolvedValue(
      new Response("plain text", { status: 200, headers: { "content-type": "text/plain" } })
    );
    const result = await runRequest(
      { method: "GET", url: "https://api.example/x", headers: {} },
      { auth: "none" }
    );
    expect(result.body).toBe("plain text");
  });
});

// ─── envAuth tests ───────────────────────────────────────────────────────────
describe("runRequest – envAuth", () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response("{}", { status: 200, headers: { "content-type": "application/json" } })
    );
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("envAuth bearer adds Authorization: Bearer even when no opts.jwt", async () => {
    await runRequest(
      { method: "GET", url: "https://api.example/x", headers: {} },
      { auth: "jwt", envAuth: { kind: "bearer", token: "env-token" } }
    );
    const [, init] = (global.fetch as any).mock.calls[0];
    expect(init.headers["Authorization"]).toBe("Bearer env-token");
  });

  it("opts.jwt overrides envAuth bearer when both are set", async () => {
    await runRequest(
      { method: "GET", url: "https://api.example/x", headers: {} },
      { auth: "jwt", jwt: "session-token", envAuth: { kind: "bearer", token: "env-token" } }
    );
    const [, init] = (global.fetch as any).mock.calls[0];
    expect(init.headers["Authorization"]).toBe("Bearer session-token");
  });

  it("envAuth apiKey in=header adds the named header", async () => {
    await runRequest(
      { method: "GET", url: "https://api.example/x", headers: {} },
      { auth: "jwt", envAuth: { kind: "apiKey", in: "header", name: "X-Api-Key", value: "key123" } }
    );
    const [, init] = (global.fetch as any).mock.calls[0];
    expect(init.headers["X-Api-Key"]).toBe("key123");
  });

  it("envAuth apiKey in=query appends ?name=value when no existing query string", async () => {
    await runRequest(
      { method: "GET", url: "https://api.example/x", headers: {} },
      { auth: "jwt", envAuth: { kind: "apiKey", in: "query", name: "api_key", value: "qval" } }
    );
    const [url] = (global.fetch as any).mock.calls[0];
    expect(url).toBe("https://api.example/x?api_key=qval");
  });

  it("envAuth apiKey in=query preserves existing query string", async () => {
    await runRequest(
      { method: "GET", url: "https://api.example/x?foo=1", headers: {} },
      { auth: "jwt", envAuth: { kind: "apiKey", in: "query", name: "api_key", value: "qval" } }
    );
    const [url] = (global.fetch as any).mock.calls[0];
    expect(url).toBe("https://api.example/x?foo=1&api_key=qval");
  });

  it("envAuth basic sends Authorization: Basic <base64> with correct credentials", async () => {
    await runRequest(
      { method: "GET", url: "https://api.example/x", headers: {} },
      { auth: "jwt", envAuth: { kind: "basic", username: "user", password: "pw" } }
    );
    const [, init] = (global.fetch as any).mock.calls[0];
    expect(init.headers["Authorization"]).toBe(`Basic ${btoa("user:pw")}`);
    // verify decoded
    const decoded = atob(init.headers["Authorization"].replace("Basic ", ""));
    expect(decoded).toBe("user:pw");
  });

  it("envAuth none does not add Authorization header", async () => {
    await runRequest(
      { method: "GET", url: "https://api.example/x", headers: {} },
      { auth: "jwt", envAuth: { kind: "none" } }
    );
    const [, init] = (global.fetch as any).mock.calls[0];
    expect(init.headers["Authorization"]).toBeUndefined();
  });

  it("envHeaders are merged into request headers", async () => {
    await runRequest(
      { method: "GET", url: "https://api.example/x", headers: {} },
      { auth: "jwt", envHeaders: { "X-Tenant": "tenant-42" } }
    );
    const [, init] = (global.fetch as any).mock.calls[0];
    expect(init.headers["X-Tenant"]).toBe("tenant-42");
  });

  it("when req.auth === none, envAuth is ignored (no Authorization added)", async () => {
    await runRequest(
      { method: "GET", url: "https://api.example/x", headers: {} },
      { auth: "none", envAuth: { kind: "bearer", token: "should-not-appear" } }
    );
    const [, init] = (global.fetch as any).mock.calls[0];
    expect(init.headers["Authorization"]).toBeUndefined();
  });

  it("when req.auth === none, apiKey envAuth is also ignored", async () => {
    await runRequest(
      { method: "GET", url: "https://api.example/x?existing=1", headers: {} },
      { auth: "none", envAuth: { kind: "apiKey", in: "query", name: "api_key", value: "secret" } }
    );
    const [url] = (global.fetch as any).mock.calls[0];
    // URL must not have api_key appended
    expect(url).toBe("https://api.example/x?existing=1");
  });

  it("when req.auth === none, envHeaders are still applied", async () => {
    await runRequest(
      { method: "GET", url: "https://api.example/x", headers: {} },
      { auth: "none", envAuth: { kind: "bearer", token: "ignored" }, envHeaders: { "X-Tenant": "t1" } }
    );
    const [, init] = (global.fetch as any).mock.calls[0];
    expect(init.headers["X-Tenant"]).toBe("t1");
    expect(init.headers["Authorization"]).toBeUndefined();
  });
});
