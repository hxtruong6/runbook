// tests/blocks/dataBlock.test.ts
import { describe, it, expect } from "vitest";
import {
  substituteTemplate,
  dataDefToBlockDef,
  BlockDefDataSchema,
} from "../../src/blocks/dataBlock";
import type { BlockDefData } from "../../src/blocks/dataBlock";

// ---------------------------------------------------------------------------
// substituteTemplate
// ---------------------------------------------------------------------------

describe("substituteTemplate", () => {
  it("whole-string token returns typed value (number stays number)", () => {
    const result = substituteTemplate("{{n}}", { n: 42 });
    expect(result).toBe(42);
    expect(typeof result).toBe("number");
  });

  it("inline substitution merges token into surrounding string", () => {
    expect(substituteTemplate("hello {{x}}", { x: "world" })).toBe("hello world");
  });

  it("whole-string token with undefined returns undefined", () => {
    expect(substituteTemplate("{{missing}}", {})).toBeUndefined();
  });

  it("inline substitution with undefined replaces with empty string", () => {
    expect(substituteTemplate("hello {{x}}", {})).toBe("hello ");
  });

  it("array: items that become undefined are dropped", () => {
    const result = substituteTemplate(["{{a}}", "{{b}}", "keep"], { a: "v" });
    expect(result).toEqual(["v", "keep"]);
  });

  it("object: keys whose values become undefined are dropped", () => {
    const result = substituteTemplate({ present: "{{a}}", absent: "{{b}}" }, { a: "yes" });
    expect(result).toEqual({ present: "yes" });
  });

  it("nested object inside object is substituted recursively", () => {
    const result = substituteTemplate(
      { outer: { inner: "{{x}}" } },
      { x: "deep" }
    );
    expect(result).toEqual({ outer: { inner: "deep" } });
  });

  it("multiple tokens in one string are all substituted", () => {
    expect(substituteTemplate("{{a}}-{{b}}", { a: "x", b: "y" })).toBe("x-y");
  });

  it("non-string primitives (number, boolean, null) pass through unchanged", () => {
    expect(substituteTemplate(99, {})).toBe(99);
    expect(substituteTemplate(true, {})).toBe(true);
    expect(substituteTemplate(null, {})).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// dataDefToBlockDef
// ---------------------------------------------------------------------------

const BASE = "https://api.example";
const opts = { resolveBaseUrl: () => BASE };

const minimalDef: BlockDefData = {
  kind: "test",
  label: "Test block",
  auth: "none",
  inputs: [],
  outputs: [],
  request: {
    method: "GET",
    urlTemplate: "/v1/users/{{id}}",
  },
};

describe("dataDefToBlockDef", () => {
  it("builds URL from urlTemplate and resolveBaseUrl", () => {
    const def = dataDefToBlockDef(minimalDef, opts);
    const req = def.build({ id: "u1" });
    expect(req.url).toBe(`${BASE}/v1/users/u1`);
    expect(req.method).toBe("GET");
  });

  it("appends query params correctly", () => {
    const def = dataDefToBlockDef(
      {
        ...minimalDef,
        request: {
          method: "GET",
          urlTemplate: "/v1/items",
          query: { tenant: "{{tenant}}", page: "1" },
        },
      },
      opts
    );
    const req = def.build({ tenant: "acme" });
    const url = new URL(req.url);
    expect(url.searchParams.get("tenant")).toBe("acme");
    expect(url.searchParams.get("page")).toBe("1");
  });

  it("omits query param when value resolves to undefined", () => {
    const def = dataDefToBlockDef(
      {
        ...minimalDef,
        request: {
          method: "GET",
          urlTemplate: "/v1/items",
          query: { optional: "{{missing}}", present: "yes" },
        },
      },
      opts
    );
    const req = def.build({});
    const url = new URL(req.url);
    expect(url.searchParams.has("optional")).toBe(false);
    expect(url.searchParams.get("present")).toBe("yes");
  });

  it("substitutes body template including static values", () => {
    const def = dataDefToBlockDef(
      {
        ...minimalDef,
        request: {
          method: "POST",
          urlTemplate: "/v1/auth",
          bodyTemplate: { email: "{{email}}", role: "DENTIST" },
        },
      },
      opts
    );
    const req = def.build({ email: "a@b.com" });
    expect(req.body).toEqual({ email: "a@b.com", role: "DENTIST" });
  });

  it("no body field on request when bodyTemplate is absent", () => {
    const def = dataDefToBlockDef(minimalDef, opts);
    const req = def.build({ id: "x" });
    expect("body" in req).toBe(false);
  });

  it("body object with one undefined value omits that key", () => {
    const def = dataDefToBlockDef(
      {
        ...minimalDef,
        request: {
          method: "POST",
          urlTemplate: "/v1/test",
          bodyTemplate: { required: "{{req}}", optional: "{{opt}}" },
        },
      },
      opts
    );
    const req = def.build({ req: "yes" });
    expect(req.body).toEqual({ required: "yes" });
  });

  it("substitutes header values and drops headers that become undefined", () => {
    const def = dataDefToBlockDef(
      {
        ...minimalDef,
        request: {
          method: "GET",
          urlTemplate: "/v1/test",
          headers: {
            "x-client-version": "0.4.0",
            "x-optional": "{{maybeHeader}}",
          },
        },
      },
      opts
    );
    const req = def.build({});
    expect(req.headers["x-client-version"]).toBe("0.4.0");
    expect("x-optional" in req.headers).toBe(false);
  });

  it("passes through kind, label, auth, inputs, outputs verbatim", () => {
    const data: BlockDefData = {
      kind: "myKind",
      label: "My Label",
      auth: "jwt",
      inputs: [{ name: "email", label: "Email", type: "string", required: true }],
      outputs: [{ jsonPath: "token", contextKey: "jwt" }],
      request: { method: "GET", urlTemplate: "/v1/test" },
    };
    const def = dataDefToBlockDef(data, opts);
    expect(def.kind).toBe("myKind");
    expect(def.label).toBe("My Label");
    expect(def.auth).toBe("jwt");
    expect(def.inputs).toEqual(data.inputs);
    expect(def.outputs).toEqual(data.outputs);
  });

  it("equivalence: signin-shaped data def matches signinDef.build output (spot-check)", () => {
    const signinData: BlockDefData = {
      kind: "signin",
      label: "Sign in (POST /v1/user/auth/signin)",
      auth: "none",
      inputs: [
        { name: "email", label: "Email", type: "string", required: true, fromContextKey: "email" },
        { name: "password", label: "Password", type: "password", required: true },
      ],
      outputs: [
        { jsonPath: "jwt", contextKey: "jwt" },
        { jsonPath: "_id", contextKey: "userId" },
      ],
      request: {
        method: "POST",
        urlTemplate: "/v1/user/auth/signin",
        headers: { "x-client-version": "0.4.0", accept: "application/json" },
        bodyTemplate: { email: "{{email}}", password: "{{password}}" },
      },
    };

    const def = dataDefToBlockDef(signinData, { resolveBaseUrl: () => BASE });
    const req = def.build({ email: "a@b.com", password: "secret" });

    expect(req.method).toBe("POST");
    expect(req.url).toMatch(/\/v1\/user\/auth\/signin$/);
    expect(req.body).toEqual({ email: "a@b.com", password: "secret" });
    expect(req.headers["x-client-version"]).toBe("0.4.0");
    expect(req.headers["accept"]).toBe("application/json");
  });

  it("query param with empty string value is omitted", () => {
    const def = dataDefToBlockDef(
      {
        ...minimalDef,
        request: {
          method: "GET",
          urlTemplate: "/v1/items",
          query: { empty: "", present: "val" },
        },
      },
      opts
    );
    const req = def.build({});
    const url = new URL(req.url);
    expect(url.searchParams.has("empty")).toBe(false);
    expect(url.searchParams.get("present")).toBe("val");
  });
});

// ---------------------------------------------------------------------------
// BlockDefDataSchema (Zod)
// ---------------------------------------------------------------------------

describe("BlockDefDataSchema", () => {
  const validDef = {
    kind: "signin",
    label: "Sign in",
    auth: "none",
    inputs: [],
    outputs: [],
    request: {
      method: "POST",
      urlTemplate: "/v1/user/auth/signin",
    },
  };

  it("accepts a valid minimal definition", () => {
    expect(() => BlockDefDataSchema.parse(validDef)).not.toThrow();
  });

  it("rejects a definition missing method", () => {
    const bad = { ...validDef, request: { urlTemplate: "/v1/test" } };
    expect(() => BlockDefDataSchema.parse(bad)).toThrow();
  });

  it("rejects an unknown method like PATCH", () => {
    const bad = {
      ...validDef,
      request: { method: "PATCH", urlTemplate: "/v1/test" },
    };
    expect(() => BlockDefDataSchema.parse(bad)).toThrow();
  });

  it("accepts empty inputs and outputs arrays", () => {
    const result = BlockDefDataSchema.parse({ ...validDef, inputs: [], outputs: [] });
    expect(result.inputs).toEqual([]);
    expect(result.outputs).toEqual([]);
  });

  it("accepts a full definition with headers, query, and bodyTemplate", () => {
    const full = {
      ...validDef,
      request: {
        method: "POST",
        urlTemplate: "/v1/auth",
        headers: { accept: "application/json" },
        query: { v: "1" },
        bodyTemplate: { email: "{{email}}", count: 3, active: true, tags: ["a", "b"] },
      },
    };
    expect(() => BlockDefDataSchema.parse(full)).not.toThrow();
  });

  it("accepts all valid AuthMode values", () => {
    for (const auth of ["none", "jwt", "cookie-or-jwt"] as const) {
      expect(() => BlockDefDataSchema.parse({ ...validDef, auth })).not.toThrow();
    }
  });

  it("rejects unknown auth mode", () => {
    expect(() => BlockDefDataSchema.parse({ ...validDef, auth: "basic" })).toThrow();
  });
});
