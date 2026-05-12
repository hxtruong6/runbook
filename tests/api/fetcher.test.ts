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
