import { describe, it, expect } from "vitest";
import {
  parsePathTokens,
  parseQueryEntries,
  parseBodyTokens,
  previewUrl,
} from "../../src/blocks/urlTemplate";

describe("parsePathTokens", () => {
  it("extracts tokens from path", () => {
    expect(parsePathTokens("/v1/users/{{userId}}/posts/{{postId}}")).toEqual(["userId", "postId"]);
  });
  it("ignores tokens in query string", () => {
    expect(parsePathTokens("/v1/users/{{userId}}?sort={{sortBy}}")).toEqual(["userId"]);
  });
  it("returns empty for no tokens", () => {
    expect(parsePathTokens("/v1/users")).toEqual([]);
  });
  it("deduplicates tokens", () => {
    expect(parsePathTokens("/v1/{{id}}/sub/{{id}}")).toEqual(["id"]);
  });
  it("handles empty string", () => {
    expect(parsePathTokens("")).toEqual([]);
  });
});

describe("parseQueryEntries", () => {
  it("extracts key-token pairs from query string", () => {
    expect(parseQueryEntries("/api?sort={{sortBy}}&limit={{limit}}")).toEqual([
      { key: "sort", token: "sortBy" },
      { key: "limit", token: "limit" },
    ]);
  });
  it("ignores non-template query values (literal strings)", () => {
    expect(parseQueryEntries("/api?format=json&id={{userId}}")).toEqual([
      { key: "id", token: "userId" },
    ]);
  });
  it("returns empty for no query string", () => {
    expect(parseQueryEntries("/api/users")).toEqual([]);
  });
  it("returns empty for empty query string", () => {
    expect(parseQueryEntries("/api?")).toEqual([]);
  });
  it("handles token name different from key", () => {
    expect(parseQueryEntries("/api?sessionId={{socketSessionUuid}}")).toEqual([
      { key: "sessionId", token: "socketSessionUuid" },
    ]);
  });
});

describe("parseBodyTokens", () => {
  it("extracts tokens from flat object values", () => {
    expect(parseBodyTokens({ slot: "{{slot}}", url: "{{photoUrl}}" })).toEqual(["slot", "photoUrl"]);
  });
  it("extracts tokens from nested object", () => {
    expect(parseBodyTokens({ user: { id: "{{userId}}" } })).toEqual(["userId"]);
  });
  it("extracts tokens from arrays", () => {
    expect(parseBodyTokens(["{{a}}", "{{b}}"])).toEqual(["a", "b"]);
  });
  it("deduplicates tokens", () => {
    expect(parseBodyTokens({ a: "{{x}}", b: "{{x}}" })).toEqual(["x"]);
  });
  it("ignores non-string primitives", () => {
    expect(parseBodyTokens({ count: 5, active: true, nothing: null })).toEqual([]);
  });
  it("extracts inline tokens (partial substitution in string)", () => {
    expect(parseBodyTokens({ greeting: "Hello {{name}}!" })).toEqual(["name"]);
  });
  it("returns empty for null input", () => {
    expect(parseBodyTokens(null)).toEqual([]);
  });
  it("extracts tokens from top-level string", () => {
    expect(parseBodyTokens("{{token}}")).toEqual(["token"]);
  });
});

describe("previewUrl", () => {
  it("substitutes filled values", () => {
    expect(previewUrl("/v1/users/{{userId}}", { userId: "abc123" })).toBe("/v1/users/abc123");
  });
  it("keeps placeholder for unfilled values", () => {
    expect(previewUrl("/v1/users/{{userId}}", {})).toBe("/v1/users/{{userId}}");
  });
  it("handles query string tokens", () => {
    expect(previewUrl("/api?sort={{sortBy}}", { sortBy: "name" })).toBe("/api?sort=name");
  });
  it("treats empty string as unfilled", () => {
    expect(previewUrl("/v1/{{id}}", { id: "" })).toBe("/v1/{{id}}");
  });
  it("substitutes multiple tokens", () => {
    expect(previewUrl("/v1/{{a}}/{{b}}", { a: "x", b: "y" })).toBe("/v1/x/y");
  });
  it("converts numeric values to string", () => {
    expect(previewUrl("/v1/{{id}}", { id: 42 })).toBe("/v1/42");
  });
});
