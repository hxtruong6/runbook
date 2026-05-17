// tests/curl/toBlock.test.ts
import { describe, it, expect } from "vitest";
import { parseCurl } from "../../src/curl/parseCurl.js";
import { toBlock } from "../../src/curl/toBlock.js";

function parse(cmd: string) {
  const r = parseCurl(cmd);
  if (!r) throw new Error(`parseCurl returned null for: ${cmd}`);
  return r;
}

describe("toBlock", () => {
  it("produces a valid block from a simple GET", () => {
    const block = toBlock(parse("curl https://api.example.com/users"), "test");
    expect(block.request.method).toBe("GET");
    expect(block.request.urlTemplate).toBe("https://api.example.com/users");
    expect(block.kind).toMatch(/^get-/);
    expect(block.label).toMatch(/GET/);
    expect(block.auth).toBe("none");
    expect(block.outputs).toHaveLength(2);
  });

  it("includes headers in the request when present", () => {
    const block = toBlock(
      parse('curl -H "Authorization: Bearer tok" https://api.example.com'),
      "test"
    );
    expect(block.request.headers).toEqual({ Authorization: "Bearer tok" });
  });

  it("parses JSON body into bodyTemplate", () => {
    const block = toBlock(
      parse("curl -X POST https://api.example.com -d '{\"key\":\"val\"}'"),
      "test"
    );
    expect(block.request.bodyTemplate).toEqual({ key: "val" });
    expect(block.request.method).toBe("POST");
  });

  it("keeps non-JSON body as a string in bodyTemplate", () => {
    const block = toBlock(
      parse("curl -X POST https://api.example.com -d 'field=value'"),
      "test"
    );
    expect(block.request.bodyTemplate).toBe("field=value");
  });

  it("generates stable kind when same suffix given", () => {
    const b1 = toBlock(parse("curl https://api.example.com/items"), "abc");
    const b2 = toBlock(parse("curl https://api.example.com/items"), "abc");
    expect(b1.kind).toBe(b2.kind);
  });

  it("generates different kind when different suffix given", () => {
    const b1 = toBlock(parse("curl https://api.example.com/items"), "aaa");
    const b2 = toBlock(parse("curl https://api.example.com/items"), "bbb");
    expect(b1.kind).not.toBe(b2.kind);
  });

  it("Stripe pattern: sets Authorization header from -u and includes in request", () => {
    const block = toBlock(
      parse("curl https://api.stripe.com/v1/customers -u sk_test_abc:"),
      "test"
    );
    expect(block.request.headers?.["Authorization"]).toMatch(/^Basic /);
  });

  it("includes url and method as inputs", () => {
    const block = toBlock(parse("curl https://api.example.com"), "test");
    const names = block.inputs.map((i) => i.name);
    expect(names).toContain("url");
    expect(names).toContain("method");
  });

  it("includes headers input when headers are present", () => {
    const block = toBlock(
      parse('curl -H "X-Foo: bar" https://api.example.com'),
      "test"
    );
    const names = block.inputs.map((i) => i.name);
    expect(names).toContain("headers");
  });

  it("includes body input when body is present", () => {
    const block = toBlock(
      parse("curl -X POST https://api.example.com -d '{}'"),
      "test"
    );
    const names = block.inputs.map((i) => i.name);
    expect(names).toContain("body");
  });

  it("outputs have correct contextKeys", () => {
    const block = toBlock(parse("curl https://api.example.com"), "test");
    const contextKeys = block.outputs.map((o) => o.contextKey);
    expect(contextKeys).toContain("lastResponse");
    expect(contextKeys).toContain("lastStatus");
  });
});
