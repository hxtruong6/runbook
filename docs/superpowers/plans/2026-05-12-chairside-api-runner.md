# Chairside API Runner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Vite + React + TS local web app where each 32CO chairside-flow API call is a typed "block" the user can run individually or chain into scenarios, with values auto-threaded through a shared context.

**Architecture:** Single-page app, no backend. Block registry (`BlockDef`) per endpoint, each with typed inputs/outputs that read from and write to a runtime context. Scenarios are arrays of block instances, persisted to localStorage, exportable as JSON. Pure logic (blocks, context, storage, fetcher) is TDD'd with Vitest; UI is verified manually against the live `32co-alpha` API.

**Tech Stack:** Vite, React 18, TypeScript, Vitest, zod, socket.io-client.

**Spec:** `docs/superpowers/specs/2026-05-12-chairside-api-runner-design.md`

---

## File Structure

```
src/
  api/
    fetcher.ts              # fetch wrapper: auth, base URL, timing, JSON parse
    socket.ts               # socket.io-client lifecycle wrapper
  blocks/
    types.ts                # BlockDef, FieldSpec, OutputSpec, BlockInstance
    index.ts                # registry: kind → BlockDef
    signin.ts
    profile.ts
    featureHighlights.ts    # exports getDef + dismissDef
    verifyDeviceToken.ts
    startChairside.ts
    uploadPhoto.ts
    getOrthoReview.ts
    updateChairsideStatus.ts
    socketConnect.ts
  context/
    ContextStore.tsx        # React context + reducer, runtime context object
  scenarios/
    types.ts                # Scenario, BlockInstance zod schemas
    storage.ts              # localStorage CRUD
    prebuilt.ts             # ships 4 default scenarios
    exportImport.ts         # download/upload JSON
  execution/
    runScenario.ts          # run all / run from here
  components/
    TopBar.tsx
    ScenarioList.tsx
    BlockList.tsx
    BlockCard.tsx
    BlockForm.tsx
    ResponseViewer.tsx
    SocketEventLog.tsx
    ContextPanel.tsx
  App.tsx
  main.tsx
  index.css
tests/                      # mirrors src/
  api/fetcher.test.ts
  blocks/*.test.ts
  context/ContextStore.test.ts
  scenarios/storage.test.ts
  scenarios/exportImport.test.ts
  execution/runScenario.test.ts
vitest.config.ts
```

The existing `src/App.tsx` (signin demo) is replaced in Task 18.

---

## Task 1: Install dependencies and configure Vitest

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `tests/setup.ts`

- [ ] **Step 1: Install runtime + dev dependencies**

Run:
```bash
pnpm add zod socket.io-client
pnpm add -D vitest @vitest/ui jsdom @testing-library/react @testing-library/jest-dom
```

- [ ] **Step 2: Add test scripts to package.json**

In `package.json`, replace the `scripts` block with:
```json
"scripts": {
  "dev": "vite --port 3000",
  "build": "tsc -b && vite build",
  "preview": "vite preview --port 3000",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
  },
});
```

- [ ] **Step 4: Create `tests/setup.ts`**

```ts
import "@testing-library/jest-dom";
```

- [ ] **Step 5: Add a placeholder smoke test at `tests/smoke.test.ts`**

```ts
import { describe, it, expect } from "vitest";

describe("smoke", () => {
  it("runs vitest", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 6: Run tests to verify setup**

Run: `pnpm test`
Expected: PASS, 1 test.

- [ ] **Step 7: Commit**

```bash
git add package.json pnpm-lock.yaml vitest.config.ts tests/setup.ts tests/smoke.test.ts
git commit -m "chore: add vitest + testing-library, install zod and socket.io-client"
```

---

## Task 2: Define block and context types

**Files:**
- Create: `src/blocks/types.ts`

- [ ] **Step 1: Write the type file**

```ts
// src/blocks/types.ts

export type RuntimeContext = Record<string, unknown> & {
  socketSessionUuid: string;
};

export type FieldType = "string" | "password" | "number" | "enum" | "json";

export type FieldSpec = {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  fromContextKey?: string;          // auto-fill from context if not overridden
  enumValues?: readonly string[];   // when type === "enum"
  placeholder?: string;
};

export type OutputSpec = {
  jsonPath: string;                 // dot path, e.g. "data.syncToken"
  contextKey: string;               // where to store in context
};

export type AuthMode = "none" | "jwt" | "cookie-or-jwt";

export type HttpRequest = {
  method: "GET" | "POST" | "PUT" | "DELETE";
  url: string;
  headers: Record<string, string>;
  body?: unknown;
};

export type BlockDef = {
  kind: string;
  label: string;
  inputs: FieldSpec[];
  outputs: OutputSpec[];
  auth: AuthMode;
  build: (values: Record<string, unknown>) => HttpRequest;
};

export type BlockInstance = {
  id: string;                       // uuid, stable across runs
  kind: string;
  overrides: Record<string, unknown>; // user-set literal values (empty = use context)
};

export type BlockRunResult =
  | { status: "ok"; httpStatus: number; elapsedMs: number; response: unknown; captured: Record<string, unknown> }
  | { status: "err"; httpStatus?: number; elapsedMs: number; response: unknown; error: string };
```

- [ ] **Step 2: Commit**

```bash
git add src/blocks/types.ts
git commit -m "feat(blocks): define BlockDef, FieldSpec, RuntimeContext types"
```

---

## Task 3: Build the fetcher with auth header logic (TDD)

**Files:**
- Create: `tests/api/fetcher.test.ts`
- Create: `src/api/fetcher.ts`

- [ ] **Step 1: Write failing tests**

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test tests/api/fetcher.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/api/fetcher.ts`**

```ts
// src/api/fetcher.ts
import type { HttpRequest, AuthMode } from "../blocks/types";

export type RunRequestOptions = {
  auth: AuthMode;
  jwt?: string;
};

export type RunRequestResult = {
  httpStatus: number;
  body: unknown;
  elapsedMs: number;
};

export async function runRequest(
  req: HttpRequest,
  opts: RunRequestOptions
): Promise<RunRequestResult> {
  const headers: Record<string, string> = { ...req.headers };
  if ((opts.auth === "jwt" || opts.auth === "cookie-or-jwt") && opts.jwt) {
    headers["Authorization"] = `Bearer ${opts.jwt}`;
  }
  if (req.body !== undefined && !headers["content-type"] && !headers["Content-Type"]) {
    headers["content-type"] = "application/json";
  }

  const init: RequestInit = {
    method: req.method,
    headers,
    credentials: "include",
  };
  if (req.body !== undefined) {
    init.body = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
  }

  const started = performance.now();
  const res = await fetch(req.url, init);
  const elapsedMs = Math.round(performance.now() - started);

  const text = await res.text();
  let body: unknown = text;
  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  return { httpStatus: res.status, body, elapsedMs };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test tests/api/fetcher.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/api/fetcher.ts tests/api/fetcher.test.ts
git commit -m "feat(api): add fetcher with bearer-or-cookie auth"
```

---

## Task 4: Implement the runtime context store (TDD)

**Files:**
- Create: `tests/context/ContextStore.test.ts`
- Create: `src/context/ContextStore.tsx`

- [ ] **Step 1: Write failing tests**

```ts
// tests/context/ContextStore.test.ts
import { describe, it, expect, vi } from "vitest";
import { contextReducer, makeInitialContext } from "../../src/context/ContextStore";

describe("contextReducer", () => {
  it("makeInitialContext generates a socketSessionUuid", () => {
    const ctx = makeInitialContext();
    expect(typeof ctx.socketSessionUuid).toBe("string");
    expect(ctx.socketSessionUuid.length).toBeGreaterThan(0);
  });

  it("MERGE merges new keys into context", () => {
    const ctx = makeInitialContext();
    const next = contextReducer(ctx, { type: "MERGE", values: { jwt: "abc" } });
    expect(next.jwt).toBe("abc");
    expect(next.socketSessionUuid).toBe(ctx.socketSessionUuid);
  });

  it("MERGE overwrites existing keys", () => {
    const ctx = { ...makeInitialContext(), jwt: "old" };
    const next = contextReducer(ctx, { type: "MERGE", values: { jwt: "new" } });
    expect(next.jwt).toBe("new");
  });

  it("SET_KEY sets a single key", () => {
    const ctx = makeInitialContext();
    const next = contextReducer(ctx, { type: "SET_KEY", key: "syncToken", value: "tok" });
    expect(next.syncToken).toBe("tok");
  });

  it("RESET clears all keys except a freshly generated socketSessionUuid", () => {
    const ctx = { ...makeInitialContext(), jwt: "x", syncToken: "y" };
    const next = contextReducer(ctx, { type: "RESET" });
    expect(next.jwt).toBeUndefined();
    expect(next.syncToken).toBeUndefined();
    expect(typeof next.socketSessionUuid).toBe("string");
    expect(next.socketSessionUuid).not.toBe(ctx.socketSessionUuid);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test tests/context/ContextStore.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/context/ContextStore.tsx`**

```tsx
// src/context/ContextStore.tsx
import { createContext, useContext, useReducer, type ReactNode } from "react";
import type { RuntimeContext } from "../blocks/types";

export type ContextAction =
  | { type: "MERGE"; values: Record<string, unknown> }
  | { type: "SET_KEY"; key: string; value: unknown }
  | { type: "RESET" };

export function makeInitialContext(): RuntimeContext {
  return { socketSessionUuid: crypto.randomUUID() };
}

export function contextReducer(state: RuntimeContext, action: ContextAction): RuntimeContext {
  switch (action.type) {
    case "MERGE":
      return { ...state, ...action.values };
    case "SET_KEY":
      return { ...state, [action.key]: action.value };
    case "RESET":
      return makeInitialContext();
  }
}

type StoreValue = {
  context: RuntimeContext;
  dispatch: React.Dispatch<ContextAction>;
};

const StoreCtx = createContext<StoreValue | null>(null);

export function ContextStoreProvider({ children }: { children: ReactNode }) {
  const [context, dispatch] = useReducer(contextReducer, undefined, makeInitialContext);
  return <StoreCtx.Provider value={{ context, dispatch }}>{children}</StoreCtx.Provider>;
}

export function useRuntimeContext(): StoreValue {
  const v = useContext(StoreCtx);
  if (!v) throw new Error("useRuntimeContext must be inside ContextStoreProvider");
  return v;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test tests/context/ContextStore.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/context/ContextStore.tsx tests/context/ContextStore.test.ts
git commit -m "feat(context): add runtime context store with reducer"
```

---

## Task 5: Add base URL config and a helper for JSON-path capture

**Files:**
- Create: `src/api/config.ts`
- Create: `src/blocks/capture.ts`
- Create: `tests/blocks/capture.test.ts`

- [ ] **Step 1: Create `src/api/config.ts`**

```ts
export const API_BASE_URL: string =
  (import.meta as any).env?.VITE_API_BASE_URL ?? "https://api-truong.32co.com";
```

- [ ] **Step 2: Write failing tests for capture**

```ts
// tests/blocks/capture.test.ts
import { describe, it, expect } from "vitest";
import { captureOutputs } from "../../src/blocks/capture";

describe("captureOutputs", () => {
  it("extracts a single dot path", () => {
    const out = captureOutputs({ data: { syncToken: "tok" } }, [
      { jsonPath: "data.syncToken", contextKey: "syncToken" },
    ]);
    expect(out).toEqual({ syncToken: "tok" });
  });

  it("extracts nested paths with arrays via [n]", () => {
    const out = captureOutputs(
      { practices: [{ id: "p1" }, { id: "p2" }] },
      [{ jsonPath: "practices[0].id", contextKey: "practiceId" }]
    );
    expect(out).toEqual({ practiceId: "p1" });
  });

  it("captures the whole response when jsonPath is '$'", () => {
    const out = captureOutputs({ a: 1 }, [{ jsonPath: "$", contextKey: "full" }]);
    expect(out).toEqual({ full: { a: 1 } });
  });

  it("skips outputs whose path is missing", () => {
    const out = captureOutputs({}, [{ jsonPath: "missing.key", contextKey: "x" }]);
    expect(out).toEqual({});
  });
});
```

- [ ] **Step 3: Implement `src/blocks/capture.ts`**

```ts
// src/blocks/capture.ts
import type { OutputSpec } from "./types";

export function getByPath(obj: unknown, path: string): unknown {
  if (path === "$") return obj;
  const parts = path
    .replace(/\[(\d+)\]/g, ".$1")
    .split(".")
    .filter(Boolean);
  let cur: any = obj;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
}

export function captureOutputs(
  response: unknown,
  outputs: OutputSpec[]
): Record<string, unknown> {
  const captured: Record<string, unknown> = {};
  for (const o of outputs) {
    const v = getByPath(response, o.jsonPath);
    if (v !== undefined) captured[o.contextKey] = v;
  }
  return captured;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test tests/blocks/capture.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/api/config.ts src/blocks/capture.ts tests/blocks/capture.test.ts
git commit -m "feat(blocks): add capture util and base URL config"
```

---

## Task 6: Implement the signin block (TDD)

**Files:**
- Create: `tests/blocks/signin.test.ts`
- Create: `src/blocks/signin.ts`

- [ ] **Step 1: Write failing tests**

```ts
// tests/blocks/signin.test.ts
import { describe, it, expect } from "vitest";
import { signinDef } from "../../src/blocks/signin";
import { captureOutputs } from "../../src/blocks/capture";

describe("signinDef", () => {
  it("builds a POST to /v1/user/auth/signin with email+password body", () => {
    const req = signinDef.build({ email: "a@b.com", password: "pw" });
    expect(req.method).toBe("POST");
    expect(req.url).toMatch(/\/v1\/user\/auth\/signin$/);
    expect(req.body).toEqual({ email: "a@b.com", password: "pw" });
    expect(req.headers["x-client-version"]).toBe("0.4.0");
  });

  it("captures jwt and userId from response", () => {
    const captured = captureOutputs(
      { jwt: "eyJ", _id: "u1", role: "DENTIST" },
      signinDef.outputs
    );
    expect(captured.jwt).toBe("eyJ");
    expect(captured.userId).toBe("u1");
  });

  it("has auth: none", () => {
    expect(signinDef.auth).toBe("none");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test tests/blocks/signin.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/blocks/signin.ts`**

```ts
// src/blocks/signin.ts
import type { BlockDef } from "./types";
import { API_BASE_URL } from "../api/config";

export const signinDef: BlockDef = {
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
  build: (v) => ({
    method: "POST",
    url: `${API_BASE_URL}/v1/user/auth/signin`,
    headers: { "x-client-version": "0.4.0", accept: "application/json" },
    body: { email: v.email, password: v.password },
  }),
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test tests/blocks/signin.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/blocks/signin.ts tests/blocks/signin.test.ts
git commit -m "feat(blocks): add signin block"
```

---

## Task 7: Implement profile and feature-highlights blocks

**Files:**
- Create: `tests/blocks/profile.test.ts`
- Create: `src/blocks/profile.ts`
- Create: `tests/blocks/featureHighlights.test.ts`
- Create: `src/blocks/featureHighlights.ts`

- [ ] **Step 1: Write failing tests for profile**

```ts
// tests/blocks/profile.test.ts
import { describe, it, expect } from "vitest";
import { profileDef } from "../../src/blocks/profile";
import { captureOutputs } from "../../src/blocks/capture";

describe("profileDef", () => {
  it("builds a GET to /v1/user/auth/profile", () => {
    const req = profileDef.build({});
    expect(req.method).toBe("GET");
    expect(req.url).toMatch(/\/v1\/user\/auth\/profile$/);
  });

  it("captures chairside fields", () => {
    const captured = captureOutputs(
      { orthoReviewChairsideToken: "tok", isChairsideEnabled: true },
      profileDef.outputs
    );
    expect(captured).toEqual({
      orthoReviewChairsideToken: "tok",
      isChairsideEnabled: true,
    });
  });

  it("has auth: cookie-or-jwt", () => {
    expect(profileDef.auth).toBe("cookie-or-jwt");
  });
});
```

- [ ] **Step 2: Implement `src/blocks/profile.ts`**

```ts
import type { BlockDef } from "./types";
import { API_BASE_URL } from "../api/config";

export const profileDef: BlockDef = {
  kind: "profile",
  label: "§1 Profile (GET /v1/user/auth/profile)",
  auth: "cookie-or-jwt",
  inputs: [],
  outputs: [
    { jsonPath: "orthoReviewChairsideToken", contextKey: "orthoReviewChairsideToken" },
    { jsonPath: "isChairsideEnabled", contextKey: "isChairsideEnabled" },
  ],
  build: () => ({
    method: "GET",
    url: `${API_BASE_URL}/v1/user/auth/profile`,
    headers: { accept: "application/json", "x-client-version": "0.4.0" },
  }),
};
```

- [ ] **Step 3: Write failing tests for feature-highlights**

```ts
// tests/blocks/featureHighlights.test.ts
import { describe, it, expect } from "vitest";
import { featureHighlightsGetDef, featureHighlightsDismissDef } from "../../src/blocks/featureHighlights";
import { captureOutputs } from "../../src/blocks/capture";

describe("featureHighlights", () => {
  it("GET builds /v1/aligner/dentist/feature-highlights and captures showChairsideInstallBanner", () => {
    const req = featureHighlightsGetDef.build({});
    expect(req.method).toBe("GET");
    expect(req.url).toMatch(/\/feature-highlights$/);

    const captured = captureOutputs({ showChairsideInstallBanner: true }, featureHighlightsGetDef.outputs);
    expect(captured.showChairsideInstallBanner).toBe(true);
  });

  it("PUT sends { showChairsideInstallBanner: false }", () => {
    const req = featureHighlightsDismissDef.build({});
    expect(req.method).toBe("PUT");
    expect(req.body).toEqual({ showChairsideInstallBanner: false });
  });
});
```

- [ ] **Step 4: Implement `src/blocks/featureHighlights.ts`**

```ts
import type { BlockDef } from "./types";
import { API_BASE_URL } from "../api/config";

const BASE = `${API_BASE_URL}/v1/aligner/dentist/feature-highlights`;
const headers = { accept: "application/json", "x-client-version": "0.4.0" };

export const featureHighlightsGetDef: BlockDef = {
  kind: "featureHighlightsGet",
  label: "§2 Feature highlights — GET",
  auth: "cookie-or-jwt",
  inputs: [],
  outputs: [
    { jsonPath: "showChairsideInstallBanner", contextKey: "showChairsideInstallBanner" },
  ],
  build: () => ({ method: "GET", url: BASE, headers }),
};

export const featureHighlightsDismissDef: BlockDef = {
  kind: "featureHighlightsDismiss",
  label: "§3 Feature highlights — Dismiss (PUT)",
  auth: "cookie-or-jwt",
  inputs: [],
  outputs: [],
  build: () => ({
    method: "PUT",
    url: BASE,
    headers,
    body: { showChairsideInstallBanner: false },
  }),
};
```

- [ ] **Step 5: Run tests**

Run: `pnpm test tests/blocks/profile.test.ts tests/blocks/featureHighlights.test.ts`
Expected: PASS, 5 tests total.

- [ ] **Step 6: Commit**

```bash
git add src/blocks/profile.ts src/blocks/featureHighlights.ts tests/blocks/profile.test.ts tests/blocks/featureHighlights.test.ts
git commit -m "feat(blocks): add profile and feature-highlights blocks"
```

---

## Task 8: Implement device-token, startChairside, and uploadPhoto blocks

**Files:**
- Create: `tests/blocks/verifyDeviceToken.test.ts`
- Create: `src/blocks/verifyDeviceToken.ts`
- Create: `tests/blocks/startChairside.test.ts`
- Create: `src/blocks/startChairside.ts`
- Create: `tests/blocks/uploadPhoto.test.ts`
- Create: `src/blocks/uploadPhoto.ts`

- [ ] **Step 1: Tests for verifyDeviceToken**

```ts
// tests/blocks/verifyDeviceToken.test.ts
import { describe, it, expect } from "vitest";
import { verifyDeviceTokenDef } from "../../src/blocks/verifyDeviceToken";
import { captureOutputs } from "../../src/blocks/capture";

describe("verifyDeviceTokenDef", () => {
  it("POSTs token in body to /chairside/device-token", () => {
    const req = verifyDeviceTokenDef.build({ orthoReviewChairsideToken: "tok" });
    expect(req.method).toBe("POST");
    expect(req.url).toMatch(/\/chairside\/device-token$/);
    expect(req.body).toEqual({ token: "tok" });
  });

  it("captures practices[0].id as practiceId", () => {
    const captured = captureOutputs(
      { user: { id: "u1" }, practices: [{ id: "p1" }, { id: "p2" }], corporate: { id: "c1" } },
      verifyDeviceTokenDef.outputs
    );
    expect(captured.practiceId).toBe("p1");
    expect(captured.userId).toBe("u1");
  });
});
```

- [ ] **Step 2: Implement verifyDeviceToken**

```ts
// src/blocks/verifyDeviceToken.ts
import type { BlockDef } from "./types";
import { API_BASE_URL } from "../api/config";

export const verifyDeviceTokenDef: BlockDef = {
  kind: "verifyDeviceToken",
  label: "§4 Verify device token (phone first-pair)",
  auth: "none",
  inputs: [
    {
      name: "orthoReviewChairsideToken",
      label: "Chairside install token",
      type: "string",
      required: true,
      fromContextKey: "orthoReviewChairsideToken",
    },
  ],
  outputs: [
    { jsonPath: "user.id", contextKey: "userId" },
    { jsonPath: "practices[0].id", contextKey: "practiceId" },
    { jsonPath: "corporate", contextKey: "corporate" },
  ],
  build: (v) => ({
    method: "POST",
    url: `${API_BASE_URL}/v1/aligner/user/ortho-reviews/chairside/device-token`,
    headers: { accept: "application/json" },
    body: { token: v.orthoReviewChairsideToken },
  }),
};
```

- [ ] **Step 3: Tests for startChairside**

```ts
// tests/blocks/startChairside.test.ts
import { describe, it, expect } from "vitest";
import { startChairsideDef } from "../../src/blocks/startChairside";
import { captureOutputs } from "../../src/blocks/capture";

describe("startChairsideDef", () => {
  it("POSTs to /chairside with body fields", () => {
    const req = startChairsideDef.build({
      firstName: "A",
      lastName: "B",
      practiceId: "p1",
      orthoReviewChairsideToken: "tok",
    });
    expect(req.method).toBe("POST");
    expect(req.url).toMatch(/\/aligner\/user\/ortho-reviews\/chairside$/);
    expect(req.body).toEqual({
      firstName: "A",
      lastName: "B",
      practiceId: "p1",
      orthoReviewChairsideToken: "tok",
    });
  });

  it("captures syncToken and orthoReviewId", () => {
    const captured = captureOutputs(
      { syncToken: "stk", orthoReview: { id: "or1" } },
      startChairsideDef.outputs
    );
    expect(captured).toEqual({ syncToken: "stk", orthoReviewId: "or1" });
  });
});
```

- [ ] **Step 4: Implement startChairside**

```ts
// src/blocks/startChairside.ts
import type { BlockDef } from "./types";
import { API_BASE_URL } from "../api/config";

export const startChairsideDef: BlockDef = {
  kind: "startChairside",
  label: "§5 Start chairside review",
  auth: "none",
  inputs: [
    { name: "firstName", label: "First name", type: "string", required: true },
    { name: "lastName", label: "Last name", type: "string", required: true },
    { name: "practiceId", label: "Practice ID", type: "string", required: true, fromContextKey: "practiceId" },
    {
      name: "orthoReviewChairsideToken",
      label: "Chairside token",
      type: "string",
      required: true,
      fromContextKey: "orthoReviewChairsideToken",
    },
  ],
  outputs: [
    { jsonPath: "syncToken", contextKey: "syncToken" },
    { jsonPath: "orthoReview.id", contextKey: "orthoReviewId" },
  ],
  build: (v) => ({
    method: "POST",
    url: `${API_BASE_URL}/v1/aligner/user/ortho-reviews/chairside`,
    headers: { accept: "application/json" },
    body: {
      firstName: v.firstName,
      lastName: v.lastName,
      practiceId: v.practiceId,
      orthoReviewChairsideToken: v.orthoReviewChairsideToken,
    },
  }),
};
```

- [ ] **Step 5: Tests for uploadPhoto**

```ts
// tests/blocks/uploadPhoto.test.ts
import { describe, it, expect } from "vitest";
import { uploadPhotoDef } from "../../src/blocks/uploadPhoto";

describe("uploadPhotoDef", () => {
  it("POSTs to /chairside/:id/photos with socketSessionUuid in query", () => {
    const req = uploadPhotoDef.build({
      orthoReviewId: "or1",
      syncToken: "stk",
      slot: "chairside-full-face",
      url: "https://x/y.jpg",
      socketSessionUuid: "uuid-1",
    });
    expect(req.method).toBe("POST");
    expect(req.url).toMatch(/\/chairside\/or1\/photos\?socketSessionUuid=uuid-1$/);
    expect(req.body).toEqual({
      syncToken: "stk",
      slot: "chairside-full-face",
      url: "https://x/y.jpg",
    });
  });

  it("omits query when socketSessionUuid is absent", () => {
    const req = uploadPhotoDef.build({
      orthoReviewId: "or1",
      syncToken: "stk",
      slot: "chairside-close-up",
      url: "https://x/z.jpg",
    });
    expect(req.url).toMatch(/\/chairside\/or1\/photos$/);
  });

  it("declares slot as an enum of 4 values", () => {
    const slotField = uploadPhotoDef.inputs.find((i) => i.name === "slot")!;
    expect(slotField.type).toBe("enum");
    expect(slotField.enumValues).toEqual([
      "chairside-full-face",
      "chairside-close-up",
      "chairside-upper-arch",
      "chairside-lower-arch",
    ]);
  });
});
```

- [ ] **Step 6: Implement uploadPhoto**

```ts
// src/blocks/uploadPhoto.ts
import type { BlockDef } from "./types";
import { API_BASE_URL } from "../api/config";

const SLOTS = [
  "chairside-full-face",
  "chairside-close-up",
  "chairside-upper-arch",
  "chairside-lower-arch",
] as const;

export const uploadPhotoDef: BlockDef = {
  kind: "uploadPhoto",
  label: "§6 Upload photo",
  auth: "none",
  inputs: [
    { name: "orthoReviewId", label: "Ortho review ID", type: "string", required: true, fromContextKey: "orthoReviewId" },
    { name: "syncToken", label: "Sync token", type: "string", required: true, fromContextKey: "syncToken" },
    { name: "slot", label: "Slot", type: "enum", required: true, enumValues: SLOTS },
    { name: "url", label: "Photo URL", type: "string", required: true, placeholder: "https://..." },
    { name: "socketSessionUuid", label: "Socket session UUID (optional)", type: "string", fromContextKey: "socketSessionUuid" },
  ],
  outputs: [],
  build: (v) => {
    const qs = v.socketSessionUuid ? `?socketSessionUuid=${encodeURIComponent(String(v.socketSessionUuid))}` : "";
    return {
      method: "POST",
      url: `${API_BASE_URL}/v1/aligner/user/ortho-reviews/chairside/${v.orthoReviewId}/photos${qs}`,
      headers: { accept: "application/json" },
      body: { syncToken: v.syncToken, slot: v.slot, url: v.url },
    };
  },
};
```

- [ ] **Step 7: Run tests**

Run: `pnpm test tests/blocks/verifyDeviceToken.test.ts tests/blocks/startChairside.test.ts tests/blocks/uploadPhoto.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 8: Commit**

```bash
git add src/blocks/verifyDeviceToken.ts src/blocks/startChairside.ts src/blocks/uploadPhoto.ts tests/blocks/verifyDeviceToken.test.ts tests/blocks/startChairside.test.ts tests/blocks/uploadPhoto.test.ts
git commit -m "feat(blocks): add device-token, startChairside, uploadPhoto"
```

---

## Task 9: Implement getOrthoReview, updateChairsideStatus, and block registry

**Files:**
- Create: `tests/blocks/getOrthoReview.test.ts`
- Create: `src/blocks/getOrthoReview.ts`
- Create: `tests/blocks/updateChairsideStatus.test.ts`
- Create: `src/blocks/updateChairsideStatus.ts`
- Create: `src/blocks/index.ts`

- [ ] **Step 1: Tests for getOrthoReview**

```ts
// tests/blocks/getOrthoReview.test.ts
import { describe, it, expect } from "vitest";
import { getOrthoReviewDef } from "../../src/blocks/getOrthoReview";

describe("getOrthoReviewDef", () => {
  it("GETs /dentist/ortho-reviews/:id", () => {
    const req = getOrthoReviewDef.build({ orthoReviewId: "or1" });
    expect(req.method).toBe("GET");
    expect(req.url).toMatch(/\/aligner\/dentist\/ortho-reviews\/or1$/);
  });

  it("uses cookie-or-jwt auth", () => {
    expect(getOrthoReviewDef.auth).toBe("cookie-or-jwt");
  });
});
```

- [ ] **Step 2: Implement getOrthoReview**

```ts
// src/blocks/getOrthoReview.ts
import type { BlockDef } from "./types";
import { API_BASE_URL } from "../api/config";

export const getOrthoReviewDef: BlockDef = {
  kind: "getOrthoReview",
  label: "§7 Get ortho review (DENTIST)",
  auth: "cookie-or-jwt",
  inputs: [
    { name: "orthoReviewId", label: "Ortho review ID", type: "string", required: true, fromContextKey: "orthoReviewId" },
  ],
  outputs: [{ jsonPath: "$", contextKey: "orthoReview" }],
  build: (v) => ({
    method: "GET",
    url: `${API_BASE_URL}/v1/aligner/dentist/ortho-reviews/${v.orthoReviewId}`,
    headers: { accept: "application/json", "x-client-version": "0.4.0" },
  }),
};
```

- [ ] **Step 3: Tests for updateChairsideStatus**

```ts
// tests/blocks/updateChairsideStatus.test.ts
import { describe, it, expect } from "vitest";
import { updateChairsideStatusDef } from "../../src/blocks/updateChairsideStatus";

describe("updateChairsideStatusDef", () => {
  it("PUTs to /chairside/:id with syncToken and chairsideStatus", () => {
    const req = updateChairsideStatusDef.build({
      orthoReviewId: "or1",
      syncToken: "stk",
      chairsideStatus: "COMPLETED",
    });
    expect(req.method).toBe("PUT");
    expect(req.url).toMatch(/\/chairside\/or1$/);
    expect(req.body).toEqual({ syncToken: "stk", chairsideStatus: "COMPLETED" });
  });

  it("declares chairsideStatus as enum of IN_PROGRESS/COMPLETED/ARCHIVED", () => {
    const field = updateChairsideStatusDef.inputs.find((i) => i.name === "chairsideStatus")!;
    expect(field.enumValues).toEqual(["IN_PROGRESS", "COMPLETED", "ARCHIVED"]);
  });
});
```

- [ ] **Step 4: Implement updateChairsideStatus**

```ts
// src/blocks/updateChairsideStatus.ts
import type { BlockDef } from "./types";
import { API_BASE_URL } from "../api/config";

const STATUSES = ["IN_PROGRESS", "COMPLETED", "ARCHIVED"] as const;

export const updateChairsideStatusDef: BlockDef = {
  kind: "updateChairsideStatus",
  label: "§8 Update chairside status",
  auth: "none",
  inputs: [
    { name: "orthoReviewId", label: "Ortho review ID", type: "string", required: true, fromContextKey: "orthoReviewId" },
    { name: "syncToken", label: "Sync token", type: "string", required: true, fromContextKey: "syncToken" },
    { name: "chairsideStatus", label: "Chairside status", type: "enum", required: true, enumValues: STATUSES },
  ],
  outputs: [{ jsonPath: "chairsideStatus", contextKey: "chairsideStatus" }],
  build: (v) => ({
    method: "PUT",
    url: `${API_BASE_URL}/v1/aligner/user/ortho-reviews/chairside/${v.orthoReviewId}`,
    headers: { accept: "application/json" },
    body: { syncToken: v.syncToken, chairsideStatus: v.chairsideStatus },
  }),
};
```

- [ ] **Step 5: Create `src/blocks/index.ts` (registry)**

```ts
// src/blocks/index.ts
import type { BlockDef } from "./types";
import { signinDef } from "./signin";
import { profileDef } from "./profile";
import { featureHighlightsGetDef, featureHighlightsDismissDef } from "./featureHighlights";
import { verifyDeviceTokenDef } from "./verifyDeviceToken";
import { startChairsideDef } from "./startChairside";
import { uploadPhotoDef } from "./uploadPhoto";
import { getOrthoReviewDef } from "./getOrthoReview";
import { updateChairsideStatusDef } from "./updateChairsideStatus";

export const BLOCK_REGISTRY: Record<string, BlockDef> = {
  [signinDef.kind]: signinDef,
  [profileDef.kind]: profileDef,
  [featureHighlightsGetDef.kind]: featureHighlightsGetDef,
  [featureHighlightsDismissDef.kind]: featureHighlightsDismissDef,
  [verifyDeviceTokenDef.kind]: verifyDeviceTokenDef,
  [startChairsideDef.kind]: startChairsideDef,
  [uploadPhotoDef.kind]: uploadPhotoDef,
  [getOrthoReviewDef.kind]: getOrthoReviewDef,
  [updateChairsideStatusDef.kind]: updateChairsideStatusDef,
};

export function getBlockDef(kind: string): BlockDef {
  const def = BLOCK_REGISTRY[kind];
  if (!def) throw new Error(`Unknown block kind: ${kind}`);
  return def;
}
```

- [ ] **Step 6: Run all block tests**

Run: `pnpm test tests/blocks`
Expected: All block tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/blocks/getOrthoReview.ts src/blocks/updateChairsideStatus.ts src/blocks/index.ts tests/blocks/getOrthoReview.test.ts tests/blocks/updateChairsideStatus.test.ts
git commit -m "feat(blocks): add getOrthoReview, updateChairsideStatus, block registry"
```

---

## Task 10: Scenario storage with zod (TDD)

**Files:**
- Create: `src/scenarios/types.ts`
- Create: `tests/scenarios/storage.test.ts`
- Create: `src/scenarios/storage.ts`

- [ ] **Step 1: Create scenario types/schema**

```ts
// src/scenarios/types.ts
import { z } from "zod";

export const BlockInstanceSchema = z.object({
  id: z.string(),
  kind: z.string(),
  overrides: z.record(z.unknown()),
});

export const ScenarioSchema = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.string(),
  blocks: z.array(BlockInstanceSchema),
});

export const ScenariosSchema = z.array(ScenarioSchema);

export type BlockInstance = z.infer<typeof BlockInstanceSchema>;
export type Scenario = z.infer<typeof ScenarioSchema>;
```

- [ ] **Step 2: Write failing tests for storage**

```ts
// tests/scenarios/storage.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { loadScenarios, saveScenarios, upsertScenario, deleteScenario } from "../../src/scenarios/storage";

describe("scenarios/storage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns [] when nothing is stored", () => {
    expect(loadScenarios()).toEqual([]);
  });

  it("saveScenarios + loadScenarios round-trips", () => {
    const s = { id: "1", name: "x", createdAt: "2026-05-12T00:00:00Z", blocks: [] };
    saveScenarios([s]);
    expect(loadScenarios()).toEqual([s]);
  });

  it("upsertScenario adds new and replaces by id", () => {
    upsertScenario({ id: "1", name: "a", createdAt: "t", blocks: [] });
    upsertScenario({ id: "2", name: "b", createdAt: "t", blocks: [] });
    upsertScenario({ id: "1", name: "a2", createdAt: "t", blocks: [] });
    const all = loadScenarios();
    expect(all).toHaveLength(2);
    expect(all.find((s) => s.id === "1")!.name).toBe("a2");
  });

  it("deleteScenario removes by id", () => {
    upsertScenario({ id: "1", name: "a", createdAt: "t", blocks: [] });
    deleteScenario("1");
    expect(loadScenarios()).toEqual([]);
  });

  it("returns [] when stored data is invalid JSON or bad shape", () => {
    localStorage.setItem("chairside-runner:scenarios", "not json");
    expect(loadScenarios()).toEqual([]);
    localStorage.setItem("chairside-runner:scenarios", JSON.stringify([{ bogus: true }]));
    expect(loadScenarios()).toEqual([]);
  });
});
```

- [ ] **Step 3: Implement storage**

```ts
// src/scenarios/storage.ts
import { ScenariosSchema, type Scenario } from "./types";

const KEY = "chairside-runner:scenarios";

export function loadScenarios(): Scenario[] {
  const raw = localStorage.getItem(KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    const result = ScenariosSchema.safeParse(parsed);
    return result.success ? result.data : [];
  } catch {
    return [];
  }
}

export function saveScenarios(scenarios: Scenario[]): void {
  localStorage.setItem(KEY, JSON.stringify(scenarios));
}

export function upsertScenario(scenario: Scenario): void {
  const all = loadScenarios();
  const idx = all.findIndex((s) => s.id === scenario.id);
  if (idx >= 0) all[idx] = scenario;
  else all.push(scenario);
  saveScenarios(all);
}

export function deleteScenario(id: string): void {
  saveScenarios(loadScenarios().filter((s) => s.id !== id));
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm test tests/scenarios/storage.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/scenarios/types.ts src/scenarios/storage.ts tests/scenarios/storage.test.ts
git commit -m "feat(scenarios): add zod-validated localStorage CRUD"
```

---

## Task 11: Prebuilt scenarios + export/import (TDD)

**Files:**
- Create: `src/scenarios/prebuilt.ts`
- Create: `tests/scenarios/exportImport.test.ts`
- Create: `src/scenarios/exportImport.ts`

- [ ] **Step 1: Create prebuilt scenarios**

```ts
// src/scenarios/prebuilt.ts
import type { Scenario } from "./types";

const t = "2026-05-12T00:00:00Z";

export const PREBUILT_SCENARIOS: Scenario[] = [
  {
    id: "prebuilt-happy-path",
    name: "Chairside happy path",
    createdAt: t,
    blocks: [
      { id: "b1", kind: "signin", overrides: { email: "truong.hoang+chairside-p001@32co.com", password: "P@ss123456_" } },
      { id: "b2", kind: "profile", overrides: {} },
      { id: "b3", kind: "startChairside", overrides: { firstName: "Test", lastName: "Patient" } },
      { id: "b4", kind: "uploadPhoto", overrides: { slot: "chairside-full-face", url: "https://example.com/full-face.jpg" } },
      { id: "b5", kind: "uploadPhoto", overrides: { slot: "chairside-close-up", url: "https://example.com/close-up.jpg" } },
      { id: "b6", kind: "uploadPhoto", overrides: { slot: "chairside-upper-arch", url: "https://example.com/upper.jpg" } },
      { id: "b7", kind: "uploadPhoto", overrides: { slot: "chairside-lower-arch", url: "https://example.com/lower.jpg" } },
      { id: "b8", kind: "getOrthoReview", overrides: {} },
      { id: "b9", kind: "updateChairsideStatus", overrides: { chairsideStatus: "COMPLETED" } },
    ],
  },
  {
    id: "prebuilt-phone-first-pair",
    name: "Phone first-pair",
    createdAt: t,
    blocks: [
      { id: "b1", kind: "verifyDeviceToken", overrides: { orthoReviewChairsideToken: "0e0ee405c57b90f97c7cd330380e9730" } },
    ],
  },
  {
    id: "prebuilt-dismiss-banner",
    name: "Dismiss install banner",
    createdAt: t,
    blocks: [
      { id: "b1", kind: "signin", overrides: { email: "truong.hoang+chairside-p001@32co.com", password: "P@ss123456_" } },
      { id: "b2", kind: "featureHighlightsGet", overrides: {} },
      { id: "b3", kind: "featureHighlightsDismiss", overrides: {} },
    ],
  },
];
```

- [ ] **Step 2: Failing tests for export/import**

```ts
// tests/scenarios/exportImport.test.ts
import { describe, it, expect } from "vitest";
import { scenarioToJson, scenarioFromJson } from "../../src/scenarios/exportImport";
import type { Scenario } from "../../src/scenarios/types";

describe("scenario export/import", () => {
  const s: Scenario = {
    id: "x",
    name: "Test",
    createdAt: "2026-05-12T00:00:00Z",
    blocks: [{ id: "b1", kind: "signin", overrides: { email: "a@b.com" } }],
  };

  it("round-trips through JSON", () => {
    const json = scenarioToJson(s);
    const parsed = scenarioFromJson(json);
    expect(parsed).toEqual(s);
  });

  it("rejects malformed JSON", () => {
    expect(() => scenarioFromJson("not json")).toThrow();
  });

  it("rejects valid JSON with wrong shape", () => {
    expect(() => scenarioFromJson(JSON.stringify({ bogus: true }))).toThrow();
  });
});
```

- [ ] **Step 3: Implement export/import**

```ts
// src/scenarios/exportImport.ts
import { ScenarioSchema, type Scenario } from "./types";

export function scenarioToJson(s: Scenario): string {
  return JSON.stringify(s, null, 2);
}

export function scenarioFromJson(text: string): Scenario {
  const parsed = JSON.parse(text);
  return ScenarioSchema.parse(parsed);
}

export function downloadScenario(s: Scenario): void {
  const blob = new Blob([scenarioToJson(s)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${s.name.replace(/\s+/g, "-")}.scenario.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function readScenarioFile(file: File): Promise<Scenario> {
  const text = await file.text();
  return scenarioFromJson(text);
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm test tests/scenarios/exportImport.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/scenarios/prebuilt.ts src/scenarios/exportImport.ts tests/scenarios/exportImport.test.ts
git commit -m "feat(scenarios): add prebuilt scenarios and export/import"
```

---

## Task 12: Execution engine — runBlock and runScenario (TDD)

**Files:**
- Create: `tests/execution/runScenario.test.ts`
- Create: `src/execution/runScenario.ts`

- [ ] **Step 1: Write failing tests**

```ts
// tests/execution/runScenario.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { resolveInputs, runBlock } from "../../src/execution/runScenario";
import type { BlockDef, BlockInstance, RuntimeContext } from "../../src/blocks/types";

const stubDef: BlockDef = {
  kind: "stub",
  label: "stub",
  auth: "none",
  inputs: [
    { name: "a", label: "a", type: "string", required: true, fromContextKey: "ctxA" },
    { name: "b", label: "b", type: "string" },
  ],
  outputs: [{ jsonPath: "out", contextKey: "outKey" }],
  build: (v) => ({ method: "POST", url: "https://x/", headers: {}, body: v }),
};

describe("resolveInputs", () => {
  it("override beats context", () => {
    const ctx: RuntimeContext = { socketSessionUuid: "u", ctxA: "from-ctx" };
    const inst: BlockInstance = { id: "1", kind: "stub", overrides: { a: "override" } };
    expect(resolveInputs(stubDef, inst, ctx)).toEqual({ a: "override" });
  });

  it("falls back to context when no override", () => {
    const ctx: RuntimeContext = { socketSessionUuid: "u", ctxA: "from-ctx" };
    const inst: BlockInstance = { id: "1", kind: "stub", overrides: {} };
    expect(resolveInputs(stubDef, inst, ctx)).toEqual({ a: "from-ctx" });
  });

  it("omits fields with no value", () => {
    const ctx: RuntimeContext = { socketSessionUuid: "u" };
    const inst: BlockInstance = { id: "1", kind: "stub", overrides: {} };
    expect(resolveInputs(stubDef, inst, ctx)).toEqual({});
  });
});

describe("runBlock", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns ok and captures outputs on 2xx", async () => {
    (global.fetch as any).mockResolvedValue(
      new Response(JSON.stringify({ out: "captured" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    const ctx: RuntimeContext = { socketSessionUuid: "u", ctxA: "from-ctx" };
    const inst: BlockInstance = { id: "1", kind: "stub", overrides: {} };
    const result = await runBlock(stubDef, inst, ctx);
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.captured).toEqual({ outKey: "captured" });
      expect(result.httpStatus).toBe(200);
    }
  });

  it("returns err on non-2xx", async () => {
    (global.fetch as any).mockResolvedValue(
      new Response(JSON.stringify({ error: "boom" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      })
    );
    const ctx: RuntimeContext = { socketSessionUuid: "u", ctxA: "x" };
    const inst: BlockInstance = { id: "1", kind: "stub", overrides: {} };
    const result = await runBlock(stubDef, inst, ctx);
    expect(result.status).toBe("err");
    if (result.status === "err") {
      expect(result.httpStatus).toBe(400);
    }
  });

  it("returns err on network throw", async () => {
    (global.fetch as any).mockRejectedValue(new Error("network down"));
    const ctx: RuntimeContext = { socketSessionUuid: "u", ctxA: "x" };
    const inst: BlockInstance = { id: "1", kind: "stub", overrides: {} };
    const result = await runBlock(stubDef, inst, ctx);
    expect(result.status).toBe("err");
    if (result.status === "err") {
      expect(result.error).toMatch(/network down/);
    }
  });
});
```

- [ ] **Step 2: Implement runScenario**

```ts
// src/execution/runScenario.ts
import type { BlockDef, BlockInstance, BlockRunResult, RuntimeContext } from "../blocks/types";
import { runRequest } from "../api/fetcher";
import { captureOutputs } from "../blocks/capture";

export function resolveInputs(
  def: BlockDef,
  inst: BlockInstance,
  ctx: RuntimeContext
): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const field of def.inputs) {
    if (field.name in inst.overrides && inst.overrides[field.name] !== "" && inst.overrides[field.name] !== undefined) {
      values[field.name] = inst.overrides[field.name];
    } else if (field.fromContextKey && ctx[field.fromContextKey] !== undefined) {
      values[field.name] = ctx[field.fromContextKey];
    }
  }
  return values;
}

export async function runBlock(
  def: BlockDef,
  inst: BlockInstance,
  ctx: RuntimeContext
): Promise<BlockRunResult> {
  const started = performance.now();
  try {
    const values = resolveInputs(def, inst, ctx);
    const req = def.build(values);
    const { httpStatus, body, elapsedMs } = await runRequest(req, {
      auth: def.auth,
      jwt: typeof ctx.jwt === "string" ? ctx.jwt : undefined,
    });
    if (httpStatus >= 200 && httpStatus < 300) {
      return {
        status: "ok",
        httpStatus,
        elapsedMs,
        response: body,
        captured: captureOutputs(body, def.outputs),
      };
    }
    return {
      status: "err",
      httpStatus,
      elapsedMs,
      response: body,
      error: `HTTP ${httpStatus}`,
    };
  } catch (e) {
    return {
      status: "err",
      elapsedMs: Math.round(performance.now() - started),
      response: null,
      error: (e as Error).message,
    };
  }
}
```

- [ ] **Step 3: Run tests**

Run: `pnpm test tests/execution/runScenario.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 4: Commit**

```bash
git add src/execution/runScenario.ts tests/execution/runScenario.test.ts
git commit -m "feat(execution): add resolveInputs and runBlock"
```

---

## Task 13: Replace App.tsx with shell layout + ContextStoreProvider

**Files:**
- Modify: `src/App.tsx` (full replace)
- Modify: `src/main.tsx` (wrap in provider)
- Modify: `src/index.css` (add layout styles)

- [ ] **Step 1: Replace `src/App.tsx`**

```tsx
// src/App.tsx
import { useEffect, useState } from "react";
import { loadScenarios, saveScenarios } from "./scenarios/storage";
import { PREBUILT_SCENARIOS } from "./scenarios/prebuilt";
import type { Scenario } from "./scenarios/types";

export function App() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    let loaded = loadScenarios();
    if (loaded.length === 0) {
      saveScenarios(PREBUILT_SCENARIOS);
      loaded = PREBUILT_SCENARIOS;
    }
    setScenarios(loaded);
    setActiveId(loaded[0]?.id ?? null);
  }, []);

  const active = scenarios.find((s) => s.id === activeId) ?? null;

  return (
    <div className="app">
      <aside className="sidebar">
        <h2>Scenarios</h2>
        <ul>
          {scenarios.map((s) => (
            <li key={s.id}>
              <button
                className={s.id === activeId ? "active" : ""}
                onClick={() => setActiveId(s.id)}
              >
                {s.name}
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <main className="main">
        <header className="topbar">
          <h1>{active?.name ?? "No scenario"}</h1>
        </header>
        <section className="blocks">
          {active ? (
            <pre>{JSON.stringify(active.blocks, null, 2)}</pre>
          ) : (
            <p>Select a scenario from the left.</p>
          )}
        </section>
      </main>

      <aside className="context">
        <h2>Context</h2>
        <p style={{ opacity: 0.6 }}>Empty (context panel wired in Task 16)</p>
      </aside>
    </div>
  );
}
```

- [ ] **Step 2: Update `src/main.tsx` to wrap in provider**

Replace `src/main.tsx` content with:
```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { ContextStoreProvider } from "./context/ContextStore";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ContextStoreProvider>
      <App />
    </ContextStoreProvider>
  </React.StrictMode>
);
```

- [ ] **Step 3: Replace `src/index.css` with layout styles**

```css
* { box-sizing: border-box; }
body, html, #root { margin: 0; height: 100%; }
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  background: #f5f5f7;
  color: #1d1d1f;
}
.app {
  display: grid;
  grid-template-columns: 220px 1fr 320px;
  height: 100vh;
}
.sidebar, .context { background: white; padding: 16px; overflow: auto; border-right: 1px solid #e5e5ea; }
.context { border-right: none; border-left: 1px solid #e5e5ea; }
.sidebar h2, .context h2 { font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; opacity: 0.6; margin: 0 0 12px; }
.sidebar ul { list-style: none; padding: 0; margin: 0; }
.sidebar li button {
  width: 100%; text-align: left; padding: 8px 10px; border: 0;
  background: transparent; border-radius: 6px; cursor: pointer; font-size: 14px;
}
.sidebar li button:hover { background: #f0f0f5; }
.sidebar li button.active { background: #e3f1ff; color: #0071e3; font-weight: 500; }
.main { display: flex; flex-direction: column; overflow: hidden; }
.topbar {
  padding: 16px 24px; background: white; border-bottom: 1px solid #e5e5ea;
  display: flex; align-items: center; gap: 12px;
}
.topbar h1 { margin: 0; font-size: 18px; }
.blocks { padding: 24px; overflow: auto; flex: 1; }
.block-card {
  background: white; border-radius: 10px; border: 1px solid #e5e5ea;
  padding: 16px; margin-bottom: 12px;
}
.block-card header { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
.block-card h3 { margin: 0; font-size: 15px; }
.badge { padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 500; }
.badge.idle { background: #e5e5ea; }
.badge.running { background: #fff3cd; color: #856404; }
.badge.ok { background: #e3f7e8; color: #1d6f2b; }
.badge.err { background: #fde7e9; color: #b00020; }
.btn {
  padding: 6px 12px; border-radius: 6px; border: 1px solid #d2d2d7;
  background: white; cursor: pointer; font-size: 13px;
}
.btn:hover { background: #f5f5f7; }
.btn.primary { background: #0071e3; color: white; border-color: #0071e3; }
.btn.primary:hover { background: #0077ed; }
.response {
  margin-top: 12px; padding: 12px; background: #1d1d1f; color: #f5f5f7;
  border-radius: 6px; font-family: ui-monospace, Menlo, monospace;
  font-size: 12px; max-height: 300px; overflow: auto; white-space: pre-wrap; word-break: break-all;
}
.field { margin-bottom: 10px; }
.field label { display: block; font-size: 12px; font-weight: 500; margin-bottom: 4px; }
.field input, .field select {
  width: 100%; padding: 6px 10px; border: 1px solid #d2d2d7; border-radius: 6px;
  font-size: 13px; font-family: inherit;
}
.field .chip {
  display: inline-block; font-size: 11px; padding: 1px 6px; border-radius: 4px;
  background: #e3f1ff; color: #0071e3; margin-left: 6px;
}
.context table { width: 100%; border-collapse: collapse; font-size: 12px; }
.context td { padding: 4px 6px; border-bottom: 1px solid #f0f0f5; vertical-align: top; }
.context td.key { font-weight: 500; color: #555; width: 40%; word-break: break-all; }
.context td input { width: 100%; border: 0; padding: 2px 4px; font-family: inherit; }
```

- [ ] **Step 4: Verify build + dev server still works**

Run: `pnpm build`
Expected: PASS.

Run dev server in background, then load http://localhost:3000/ and confirm the 3-pane layout renders with the 3 prebuilt scenarios in the left sidebar.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/main.tsx src/index.css
git commit -m "feat(ui): add 3-pane shell layout and load prebuilt scenarios"
```

---

## Task 14: BlockCard, BlockForm, ResponseViewer

**Files:**
- Create: `src/components/BlockForm.tsx`
- Create: `src/components/ResponseViewer.tsx`
- Create: `src/components/BlockCard.tsx`

- [ ] **Step 1: Create `src/components/BlockForm.tsx`**

```tsx
// src/components/BlockForm.tsx
import type { BlockDef, FieldSpec, RuntimeContext } from "../blocks/types";

type Props = {
  def: BlockDef;
  overrides: Record<string, unknown>;
  context: RuntimeContext;
  onChange: (overrides: Record<string, unknown>) => void;
};

function Field({ field, overrides, context, onChange }: { field: FieldSpec } & Omit<Props, "def">) {
  const override = overrides[field.name];
  const ctxVal = field.fromContextKey ? context[field.fromContextKey] : undefined;
  const effective = override !== undefined && override !== "" ? override : ctxVal ?? "";
  const usingContext = (override === undefined || override === "") && ctxVal !== undefined;

  function update(value: string) {
    onChange({ ...overrides, [field.name]: value });
  }

  return (
    <div className="field">
      <label>
        {field.label}
        {usingContext && <span className="chip">← context: {field.fromContextKey}</span>}
      </label>
      {field.type === "enum" ? (
        <select value={String(effective)} onChange={(e) => update(e.target.value)}>
          <option value="">— select —</option>
          {field.enumValues?.map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>
      ) : (
        <input
          type={field.type === "password" ? "password" : "text"}
          value={String(effective)}
          placeholder={field.placeholder}
          onChange={(e) => update(e.target.value)}
        />
      )}
    </div>
  );
}

export function BlockForm({ def, overrides, context, onChange }: Props) {
  if (def.inputs.length === 0) {
    return <p style={{ fontSize: 12, opacity: 0.6 }}>No inputs.</p>;
  }
  return (
    <div>
      {def.inputs.map((f) => (
        <Field key={f.name} field={f} overrides={overrides} context={context} onChange={onChange} />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create `src/components/ResponseViewer.tsx`**

```tsx
// src/components/ResponseViewer.tsx
import type { BlockRunResult } from "../blocks/types";

export function ResponseViewer({ result }: { result: BlockRunResult | null }) {
  if (!result) return null;
  const text =
    typeof result.response === "string"
      ? result.response
      : JSON.stringify(result.response, null, 2);
  const code = "httpStatus" in result ? result.httpStatus : "—";
  const note = result.status === "err" ? ` — ${result.error}` : "";
  return (
    <div>
      <div style={{ fontSize: 12, opacity: 0.7, marginTop: 8 }}>
        HTTP {code} · {result.elapsedMs}ms{note}
      </div>
      <pre className="response">{text}</pre>
    </div>
  );
}
```

- [ ] **Step 3: Create `src/components/BlockCard.tsx`**

```tsx
// src/components/BlockCard.tsx
import { useState } from "react";
import { getBlockDef } from "../blocks";
import { runBlock } from "../execution/runScenario";
import type { BlockInstance, BlockRunResult } from "../blocks/types";
import { useRuntimeContext } from "../context/ContextStore";
import { BlockForm } from "./BlockForm";
import { ResponseViewer } from "./ResponseViewer";

type Props = {
  block: BlockInstance;
  onChange: (next: BlockInstance) => void;
  onRunFromHere?: () => void;
};

export function BlockCard({ block, onChange, onRunFromHere }: Props) {
  const def = getBlockDef(block.kind);
  const { context, dispatch } = useRuntimeContext();
  const [result, setResult] = useState<BlockRunResult | null>(null);
  const [running, setRunning] = useState(false);

  const status: "idle" | "running" | "ok" | "err" = running
    ? "running"
    : result?.status === "ok"
      ? "ok"
      : result?.status === "err"
        ? "err"
        : "idle";

  async function run() {
    setRunning(true);
    const r = await runBlock(def, block, context);
    setResult(r);
    if (r.status === "ok") {
      dispatch({ type: "MERGE", values: r.captured });
    }
    setRunning(false);
  }

  return (
    <div className="block-card">
      <header>
        <span className={`badge ${status}`}>{status}</span>
        <h3>{def.label}</h3>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          {onRunFromHere && (
            <button className="btn" onClick={onRunFromHere}>Run from here</button>
          )}
          <button className="btn primary" onClick={run} disabled={running}>
            {running ? "Running..." : "Run"}
          </button>
        </div>
      </header>
      <BlockForm
        def={def}
        overrides={block.overrides}
        context={context}
        onChange={(o) => onChange({ ...block, overrides: o })}
      />
      <ResponseViewer result={result} />
    </div>
  );
}
```

- [ ] **Step 4: Wire BlockCard into App.tsx**

Replace the `<section className="blocks">` body in `src/App.tsx`:
```tsx
<section className="blocks">
  {active ? (
    active.blocks.map((b, i) => (
      <BlockCard
        key={b.id}
        block={b}
        onChange={(next) => {
          const updatedBlocks = [...active.blocks];
          updatedBlocks[i] = next;
          const updated = { ...active, blocks: updatedBlocks };
          setScenarios((all) => all.map((s) => (s.id === active.id ? updated : s)));
        }}
      />
    ))
  ) : (
    <p>Select a scenario from the left.</p>
  )}
</section>
```

Add the import: `import { BlockCard } from "./components/BlockCard";`.

- [ ] **Step 5: Verify in browser**

Run dev server. Open http://localhost:3000/, pick "Chairside happy path", click **Run** on the signin block. Confirm: status badge flips to running → ok, response renders, and the `jwt` value will appear in context (verified in next task).

- [ ] **Step 6: Commit**

```bash
git add src/components/BlockForm.tsx src/components/ResponseViewer.tsx src/components/BlockCard.tsx src/App.tsx
git commit -m "feat(ui): per-block run with form, response viewer, and context capture"
```

---

## Task 15: ContextPanel

**Files:**
- Create: `src/components/ContextPanel.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create `src/components/ContextPanel.tsx`**

```tsx
// src/components/ContextPanel.tsx
import { useRuntimeContext } from "../context/ContextStore";

const REDACTED_KEYS = new Set(["password"]);

export function ContextPanel() {
  const { context, dispatch } = useRuntimeContext();
  const entries = Object.entries(context).sort(([a], [b]) => a.localeCompare(b));

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button className="btn" onClick={() => dispatch({ type: "RESET" })}>Reset</button>
      </div>
      <table>
        <tbody>
          {entries.map(([k, v]) => (
            <tr key={k}>
              <td className="key">{k}</td>
              <td>
                {REDACTED_KEYS.has(k) ? (
                  <span style={{ opacity: 0.5 }}>•••</span>
                ) : typeof v === "object" ? (
                  <code style={{ fontSize: 11 }}>{JSON.stringify(v).slice(0, 80)}</code>
                ) : (
                  <input
                    value={v === undefined || v === null ? "" : String(v)}
                    onChange={(e) =>
                      dispatch({ type: "SET_KEY", key: k, value: e.target.value })
                    }
                  />
                )}
              </td>
            </tr>
          ))}
          {entries.length === 0 && (
            <tr>
              <td colSpan={2} style={{ opacity: 0.5, fontSize: 12 }}>Empty</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Wire it into App.tsx**

In `src/App.tsx`, replace the `<aside className="context">` body:
```tsx
<aside className="context">
  <h2>Context</h2>
  <ContextPanel />
</aside>
```

Add the import: `import { ContextPanel } from "./components/ContextPanel";`.

- [ ] **Step 3: Verify in browser**

Run the signin block. Confirm `jwt` and `userId` appear in the Context panel, and you can edit `jwt` inline. Click **Reset** — all keys clear and `socketSessionUuid` regenerates.

- [ ] **Step 4: Commit**

```bash
git add src/components/ContextPanel.tsx src/App.tsx
git commit -m "feat(ui): add live context panel with inline editing"
```

---

## Task 16: TopBar — Run all, Run from here, Export, Import, Reset

**Files:**
- Create: `src/components/TopBar.tsx`
- Modify: `src/App.tsx`
- Modify: `src/execution/runScenario.ts` (add `runScenarioFrom`)
- Modify: `tests/execution/runScenario.test.ts` (add test for early-stop)

- [ ] **Step 1: Add `runScenarioFrom` test**

Append to `tests/execution/runScenario.test.ts`:
```ts
import { runScenarioFrom } from "../../src/execution/runScenario";
import { BLOCK_REGISTRY } from "../../src/blocks";

describe("runScenarioFrom", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("stops on first error and reports index", async () => {
    (global.fetch as any)
      .mockResolvedValueOnce(new Response(JSON.stringify({ jwt: "j", _id: "u" }), { status: 200, headers: { "content-type": "application/json" } }))
      .mockResolvedValueOnce(new Response("{}", { status: 500, headers: { "content-type": "application/json" } }));

    const blocks = [
      { id: "1", kind: "signin", overrides: { email: "a@b.com", password: "pw" } },
      { id: "2", kind: "profile", overrides: {} },
    ];
    let ctx = { socketSessionUuid: "u" } as any;
    const results: any[] = [];
    await runScenarioFrom(blocks, 0, ctx, (newCtx, idx, result) => {
      ctx = newCtx;
      results.push({ idx, status: result.status });
    });
    expect(results).toEqual([
      { idx: 0, status: "ok" },
      { idx: 1, status: "err" },
    ]);
    expect((global.fetch as any).mock.calls).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Implement `runScenarioFrom`**

Append to `src/execution/runScenario.ts`:
```ts
import type { Scenario } from "../scenarios/types";
import { BLOCK_REGISTRY } from "../blocks";

export async function runScenarioFrom(
  blocks: Scenario["blocks"],
  startIdx: number,
  initialCtx: RuntimeContext,
  onResult: (ctx: RuntimeContext, idx: number, result: BlockRunResult) => void
): Promise<void> {
  let ctx = initialCtx;
  for (let i = startIdx; i < blocks.length; i++) {
    const inst = blocks[i];
    const def = BLOCK_REGISTRY[inst.kind];
    if (!def) {
      onResult(ctx, i, {
        status: "err",
        elapsedMs: 0,
        response: null,
        error: `Unknown block kind: ${inst.kind}`,
      });
      return;
    }
    const result = await runBlock(def, inst, ctx);
    if (result.status === "ok") {
      ctx = { ...ctx, ...result.captured };
    }
    onResult(ctx, i, result);
    if (result.status === "err") return;
  }
}
```

- [ ] **Step 3: Run tests**

Run: `pnpm test tests/execution/runScenario.test.ts`
Expected: PASS, 7 tests total.

- [ ] **Step 4: Create `src/components/TopBar.tsx`**

```tsx
// src/components/TopBar.tsx
import type { Scenario } from "../scenarios/types";
import { downloadScenario, readScenarioFile } from "../scenarios/exportImport";

type Props = {
  active: Scenario | null;
  onRunAll: () => void;
  onImport: (s: Scenario) => void;
};

export function TopBar({ active, onRunAll, onImport }: Props) {
  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const s = await readScenarioFile(file);
      onImport({ ...s, id: crypto.randomUUID(), createdAt: new Date().toISOString() });
    } catch (err) {
      alert("Invalid scenario file: " + (err as Error).message);
    }
    e.target.value = "";
  }

  return (
    <header className="topbar">
      <h1>{active?.name ?? "No scenario"}</h1>
      <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
        <button className="btn primary" disabled={!active} onClick={onRunAll}>
          Run all
        </button>
        <button className="btn" disabled={!active} onClick={() => active && downloadScenario(active)}>
          Export
        </button>
        <label className="btn" style={{ cursor: "pointer" }}>
          Import
          <input type="file" accept="application/json" hidden onChange={handleImport} />
        </label>
      </div>
    </header>
  );
}
```

- [ ] **Step 5: Wire TopBar + Run all into App.tsx**

Replace `<header className="topbar">...</header>` in `src/App.tsx` with `<TopBar ... />`. Use the new `runScenarioFrom` from execution. Full replacement of `App.tsx`:

```tsx
// src/App.tsx
import { useEffect, useState } from "react";
import { loadScenarios, saveScenarios, upsertScenario } from "./scenarios/storage";
import { PREBUILT_SCENARIOS } from "./scenarios/prebuilt";
import type { Scenario } from "./scenarios/types";
import { BlockCard } from "./components/BlockCard";
import { ContextPanel } from "./components/ContextPanel";
import { TopBar } from "./components/TopBar";
import { useRuntimeContext } from "./context/ContextStore";
import { runScenarioFrom } from "./execution/runScenario";

export function App() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const { context, dispatch } = useRuntimeContext();

  useEffect(() => {
    let loaded = loadScenarios();
    if (loaded.length === 0) {
      saveScenarios(PREBUILT_SCENARIOS);
      loaded = PREBUILT_SCENARIOS;
    }
    setScenarios(loaded);
    setActiveId(loaded[0]?.id ?? null);
  }, []);

  const active = scenarios.find((s) => s.id === activeId) ?? null;

  function updateActive(next: Scenario) {
    setScenarios((all) => all.map((s) => (s.id === next.id ? next : s)));
    upsertScenario(next);
  }

  async function runFrom(startIdx: number) {
    if (!active) return;
    await runScenarioFrom(active.blocks, startIdx, context, (newCtx) => {
      dispatch({ type: "MERGE", values: newCtx });
    });
  }

  function importScenario(s: Scenario) {
    setScenarios((all) => [...all, s]);
    upsertScenario(s);
    setActiveId(s.id);
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <h2>Scenarios</h2>
        <ul>
          {scenarios.map((s) => (
            <li key={s.id}>
              <button
                className={s.id === activeId ? "active" : ""}
                onClick={() => setActiveId(s.id)}
              >
                {s.name}
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <main className="main">
        <TopBar active={active} onRunAll={() => runFrom(0)} onImport={importScenario} />
        <section className="blocks">
          {active ? (
            active.blocks.map((b, i) => (
              <BlockCard
                key={b.id}
                block={b}
                onChange={(next) => {
                  const updatedBlocks = [...active.blocks];
                  updatedBlocks[i] = next;
                  updateActive({ ...active, blocks: updatedBlocks });
                }}
                onRunFromHere={() => runFrom(i)}
              />
            ))
          ) : (
            <p>Select a scenario from the left.</p>
          )}
        </section>
      </main>

      <aside className="context">
        <h2>Context</h2>
        <ContextPanel />
      </aside>
    </div>
  );
}
```

- [ ] **Step 6: Manual verification**

Run dev server. With "Chairside happy path", click **Run all**. Expected: signin → ok, profile → ok (jwt now in context), startChairside → ok (syncToken, orthoReviewId in context), 4 photo uploads → likely fail (placeholder URLs), execution stops. Edit a photo URL to a real one and run again.

- [ ] **Step 7: Commit**

```bash
git add src/components/TopBar.tsx src/App.tsx src/execution/runScenario.ts tests/execution/runScenario.test.ts
git commit -m "feat(ui): add TopBar with Run all, Export, Import"
```

---

## Task 17: Add Socket.IO block + SocketEventLog

**Files:**
- Create: `src/api/socket.ts`
- Create: `src/blocks/socketConnect.ts`
- Modify: `src/blocks/index.ts` (register socketConnect)
- Create: `src/components/SocketEventLog.tsx`
- Modify: `src/components/BlockCard.tsx` (special-case socket blocks)
- Create: `src/scenarios/prebuilt.ts` entry — add "Realtime sanity"

- [ ] **Step 1: Create `src/api/socket.ts`**

```ts
// src/api/socket.ts
import { io, type Socket } from "socket.io-client";
import { API_BASE_URL } from "./config";

export type SocketEvent = {
  receivedAt: string;
  payload: unknown;
};

export type SocketSession = {
  socket: Socket;
  events: SocketEvent[];
  subscribe: (cb: (events: SocketEvent[]) => void) => () => void;
  disconnect: () => void;
};

export function openChairsideSocket(opts: {
  userId: string;
  role: string;
  orthoReviewId: string;
  ownSocketSessionUuid: string;
}): SocketSession {
  const socket = io(API_BASE_URL, {
    path: "/chat",
    query: { userId: opts.userId, role: opts.role },
    withCredentials: true,
    transports: ["websocket", "polling"],
  });

  const events: SocketEvent[] = [];
  const listeners = new Set<(events: SocketEvent[]) => void>();
  const notify = () => listeners.forEach((cb) => cb([...events]));

  socket.on("connect", () => {
    socket.emit("join_chairside_session", { sessionId: opts.orthoReviewId });
  });

  socket.on("chairside_session_update", (payload: any) => {
    if (payload?.socketSessionUuid && payload.socketSessionUuid === opts.ownSocketSessionUuid) {
      return; // echo suppression
    }
    events.push({ receivedAt: new Date().toISOString(), payload });
    notify();
  });

  return {
    socket,
    events,
    subscribe(cb) {
      listeners.add(cb);
      cb([...events]);
      return () => listeners.delete(cb);
    },
    disconnect() {
      socket.disconnect();
    },
  };
}
```

- [ ] **Step 2: Create `src/blocks/socketConnect.ts`**

```ts
// src/blocks/socketConnect.ts
import type { BlockDef } from "./types";

export const socketConnectDef: BlockDef = {
  kind: "socketConnect",
  label: "§9 Socket.IO — join chairside session",
  auth: "cookie-or-jwt",
  inputs: [
    { name: "userId", label: "User ID", type: "string", required: true, fromContextKey: "userId" },
    { name: "role", label: "Role", type: "enum", required: true, enumValues: ["DENTIST", "USER"] },
    { name: "orthoReviewId", label: "Ortho review ID", type: "string", required: true, fromContextKey: "orthoReviewId" },
  ],
  outputs: [],
  build: () => {
    throw new Error("socketConnect uses connect(), not build()");
  },
};
```

- [ ] **Step 3: Register in `src/blocks/index.ts`**

Add to imports + registry map:
```ts
import { socketConnectDef } from "./socketConnect";
// ...
[socketConnectDef.kind]: socketConnectDef,
```

- [ ] **Step 4: Create `src/components/SocketEventLog.tsx`**

```tsx
// src/components/SocketEventLog.tsx
import type { SocketEvent } from "../api/socket";

export function SocketEventLog({ events }: { events: SocketEvent[] }) {
  if (events.length === 0) return <p style={{ fontSize: 12, opacity: 0.6 }}>No events yet.</p>;
  return (
    <div>
      {events.map((e, i) => (
        <pre key={i} className="response" style={{ marginTop: 6 }}>
          {e.receivedAt}{"\n"}
          {JSON.stringify(e.payload, null, 2)}
        </pre>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Special-case socket blocks in `BlockCard.tsx`**

Replace `src/components/BlockCard.tsx` entirely:
```tsx
import { useEffect, useRef, useState } from "react";
import { getBlockDef } from "../blocks";
import { runBlock, resolveInputs } from "../execution/runScenario";
import type { BlockInstance, BlockRunResult } from "../blocks/types";
import { useRuntimeContext } from "../context/ContextStore";
import { BlockForm } from "./BlockForm";
import { ResponseViewer } from "./ResponseViewer";
import { openChairsideSocket, type SocketEvent, type SocketSession } from "../api/socket";
import { SocketEventLog } from "./SocketEventLog";

type Props = {
  block: BlockInstance;
  onChange: (next: BlockInstance) => void;
  onRunFromHere?: () => void;
};

export function BlockCard({ block, onChange, onRunFromHere }: Props) {
  const def = getBlockDef(block.kind);
  const { context, dispatch } = useRuntimeContext();
  const [result, setResult] = useState<BlockRunResult | null>(null);
  const [running, setRunning] = useState(false);
  const sessionRef = useRef<SocketSession | null>(null);
  const [events, setEvents] = useState<SocketEvent[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    return () => sessionRef.current?.disconnect();
  }, []);

  const isSocket = def.kind === "socketConnect";

  async function runHttp() {
    setRunning(true);
    const r = await runBlock(def, block, context);
    setResult(r);
    if (r.status === "ok") dispatch({ type: "MERGE", values: r.captured });
    setRunning(false);
  }

  function connectSocket() {
    sessionRef.current?.disconnect();
    const values = resolveInputs(def, block, context);
    if (!values.userId || !values.orthoReviewId || !values.role) {
      setResult({ status: "err", elapsedMs: 0, response: null, error: "Missing userId/role/orthoReviewId" });
      return;
    }
    const session = openChairsideSocket({
      userId: String(values.userId),
      role: String(values.role),
      orthoReviewId: String(values.orthoReviewId),
      ownSocketSessionUuid: context.socketSessionUuid,
    });
    sessionRef.current = session;
    setConnected(true);
    session.subscribe(setEvents);
  }

  function disconnectSocket() {
    sessionRef.current?.disconnect();
    sessionRef.current = null;
    setConnected(false);
  }

  const status: "idle" | "running" | "ok" | "err" = isSocket
    ? (connected ? "ok" : "idle")
    : running
      ? "running"
      : result?.status === "ok" ? "ok" : result?.status === "err" ? "err" : "idle";

  return (
    <div className="block-card">
      <header>
        <span className={`badge ${status}`}>{isSocket ? (connected ? "connected" : "idle") : status}</span>
        <h3>{def.label}</h3>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          {onRunFromHere && !isSocket && (
            <button className="btn" onClick={onRunFromHere}>Run from here</button>
          )}
          {isSocket ? (
            <button className="btn primary" onClick={connected ? disconnectSocket : connectSocket}>
              {connected ? "Disconnect" : "Connect"}
            </button>
          ) : (
            <button className="btn primary" onClick={runHttp} disabled={running}>
              {running ? "Running..." : "Run"}
            </button>
          )}
        </div>
      </header>
      <BlockForm
        def={def}
        overrides={block.overrides}
        context={context}
        onChange={(o) => onChange({ ...block, overrides: o })}
      />
      {isSocket ? <SocketEventLog events={events} /> : <ResponseViewer result={result} />}
    </div>
  );
}
```

- [ ] **Step 6: Add the "Realtime sanity" prebuilt scenario**

In `src/scenarios/prebuilt.ts`, append a fourth entry:
```ts
{
  id: "prebuilt-realtime-sanity",
  name: "Realtime sanity",
  createdAt: t,
  blocks: [
    { id: "b1", kind: "signin", overrides: { email: "truong.hoang+chairside-p001@32co.com", password: "P@ss123456_" } },
    { id: "b2", kind: "startChairside", overrides: { firstName: "Test", lastName: "Realtime" } },
    { id: "b3", kind: "socketConnect", overrides: { role: "DENTIST" } },
    { id: "b4", kind: "uploadPhoto", overrides: { slot: "chairside-full-face", url: "https://example.com/full.jpg" } },
    { id: "b5", kind: "updateChairsideStatus", overrides: { chairsideStatus: "COMPLETED" } },
  ],
},
```

- [ ] **Step 7: Skip socket blocks in Run all**

In `src/execution/runScenario.ts`, modify `runScenarioFrom` to skip socket kinds:
```ts
const def = BLOCK_REGISTRY[inst.kind];
if (!def) { /* ... existing err branch ... */ }
if (def.kind === "socketConnect") {
  onResult(ctx, i, { status: "ok", httpStatus: 0, elapsedMs: 0, response: "skipped (socket)", captured: {} });
  continue;
}
```

- [ ] **Step 8: Run tests**

Run: `pnpm test`
Expected: all tests PASS.

- [ ] **Step 9: Manual verification**

Run dev. Pick "Realtime sanity". Sign in, start chairside, click Connect on the socket block, then upload photo and update status. Confirm events appear in the socket log.

Note: socket may fail to connect if your local origin isn't whitelisted by the server's CORS — this is environment-dependent and not a code bug.

- [ ] **Step 10: Commit**

```bash
git add src/api/socket.ts src/blocks/socketConnect.ts src/blocks/index.ts src/components/SocketEventLog.tsx src/components/BlockCard.tsx src/scenarios/prebuilt.ts src/execution/runScenario.ts
git commit -m "feat(socket): add socketConnect block with live event log"
```

---

## Task 18: Final pass — full test run, build, and prebuilt-scenario reset

**Files:**
- Modify: `src/App.tsx` (add small "Reload prebuilt" button for dev convenience)

- [ ] **Step 1: Add a small reset-prebuilt button to the sidebar**

In `src/App.tsx`, inside the `<aside className="sidebar">`, above the `<ul>`:
```tsx
<button
  className="btn"
  style={{ width: "100%", marginBottom: 12 }}
  onClick={() => {
    saveScenarios(PREBUILT_SCENARIOS);
    setScenarios(PREBUILT_SCENARIOS);
    setActiveId(PREBUILT_SCENARIOS[0]?.id ?? null);
  }}
>
  Reset to prebuilt
</button>
```

- [ ] **Step 2: Run the full test suite**

Run: `pnpm test`
Expected: all tests PASS.

- [ ] **Step 3: Run the production build**

Run: `pnpm build`
Expected: PASS, no TypeScript errors.

- [ ] **Step 4: Manual verification checklist**

Open http://localhost:3000/ and verify each of these:

- [ ] Sidebar shows 4 prebuilt scenarios
- [ ] "Chairside happy path": click each block's Run in order — signin captures `jwt`, profile captures `orthoReviewChairsideToken`, startChairside captures `syncToken` and `orthoReviewId`, photo uploads work after editing URLs to real ones, getOrthoReview returns the review, updateChairsideStatus marks COMPLETED.
- [ ] "Run all" early-stops on first non-2xx and scrolls/highlights nothing extra (acceptable for v1)
- [ ] Context panel shows captured values and allows editing `jwt` inline
- [ ] **Reset** clears all keys and regenerates `socketSessionUuid`
- [ ] **Export** downloads a `<name>.scenario.json` file
- [ ] **Import** loads an exported file as a new scenario
- [ ] "Realtime sanity": socket block connects, events appear after upload/status updates
- [ ] "Reset to prebuilt" button restores the original 4 scenarios

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "feat(ui): add 'Reset to prebuilt' button for dev convenience"
```

---

## Done

The app now supports composing, running, and sharing chairside flow scenarios. Future work (not in this plan): S3 photo upload helper, per-block assertions, backend persistence, recording mode, run-diff replay.
