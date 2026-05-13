# API Result Panel Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the API block result panel to show a status bar, tabbed Response/Request/Code views, copyable code snippets (curl/Node/Axios), and a full request+response copy button.

**Architecture:** Extend the data layer so `runRequest` captures the fully-resolved HTTP request (with auth headers merged in) and threads it through `BlockRunResult` as an optional `request` field. `ResponseViewer` is then refactored into focused sub-components inside the same file. A new `src/components/snippets.ts` holds pure code-generator functions for easy testing. Redaction is display-only; clipboard always receives real values.

**Tech Stack:** React, Mantine v7, @tabler/icons-react, Vitest

---

## File Map

| File | Change |
|---|---|
| `src/blocks/types.ts` | Add `ResolvedRequest` type; add optional `request` to both branches of `BlockRunResult` |
| `src/api/fetcher.ts` | Add `resolvedRequest` to `RunRequestResult`; return it from `runRequest` |
| `src/execution/runScenario.ts` | Propagate `resolvedRequest` → `request` in `runBlock` only |
| `src/components/snippets.ts` | New file — pure functions: `generateCurl`, `generateNodeFetch`, `generateAxios`, `redactSnippet`, `redactHeaders`, `formatRequestResponse` |
| `src/components/ResponseViewer.tsx` | Full redesign: `ResultStatusBar`, `RequestTab`, `CodeTab`, `ResponseViewer` |
| `tests/components/snippets.test.ts` | New file — unit tests for all snippet utilities |

---

## Task 1: Add `ResolvedRequest` type and update `BlockRunResult`

**Files:**
- Modify: `src/blocks/types.ts`

- [ ] **Step 1: Add `ResolvedRequest` and update `BlockRunResult`**

Replace the entire `BlockRunResult` type section in `src/blocks/types.ts` (lines 48–50) with:

```ts
export type ResolvedRequest = {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: unknown;
};

export type BlockRunResult =
  | { status: "ok";  httpStatus: number; elapsedMs: number; response: unknown; captured: Record<string, unknown>; request?: ResolvedRequest; subResults?: BlockRunResult[] }
  | { status: "err"; httpStatus?: number; elapsedMs: number; response: unknown; error: string; request?: ResolvedRequest; subResults?: BlockRunResult[] };
```

- [ ] **Step 2: Verify no TypeScript errors**

```bash
pnpm tsc --noEmit
```

Expected: no errors (all existing consumers treat `request` as optional).

---

## Task 2: Return resolved request from `runRequest`

**Files:**
- Modify: `src/api/fetcher.ts`

- [ ] **Step 1: Add `resolvedRequest` to `RunRequestResult`**

In `src/api/fetcher.ts`, update the `RunRequestResult` type:

```ts
import type { ResolvedRequest } from "../blocks/types";

export type RunRequestResult = {
  httpStatus: number;
  body: unknown;
  elapsedMs: number;
  resolvedRequest: ResolvedRequest;
};
```

- [ ] **Step 2: Return `resolvedRequest` from `runRequest`**

At the end of `runRequest`, replace the `return` statement:

```ts
return { httpStatus: res.status, body, elapsedMs };
```

with:

```ts
return {
  httpStatus: res.status,
  body,
  elapsedMs,
  resolvedRequest: { method: req.method, url, headers, body: req.body },
};
```

Note: `url` and `headers` are already the final resolved values (with auth merged in) at that point in the function.

- [ ] **Step 3: Verify no TypeScript errors**

```bash
pnpm tsc --noEmit
```

Expected: no errors.

---

## Task 3: Propagate `request` through `runBlock`

**Files:**
- Modify: `src/execution/runScenario.ts`

- [ ] **Step 1: Thread `resolvedRequest` into `BlockRunResult` in `runBlock`**

In `runBlock` (lines 26–66), update the destructure and both return statements:

```ts
const { httpStatus, body, elapsedMs, resolvedRequest } = await runRequest(req, {
  auth: def.auth,
  jwt: typeof ctx.jwt === "string" ? ctx.jwt : undefined,
  envAuth: env?.auth,
  envHeaders: env?.headers,
});
if (httpStatus >= 200 && httpStatus < 300) {
  return {
    status: "ok",
    httpStatus,
    elapsedMs,
    response: body,
    captured: captureOutputs(body, def.outputs),
    request: resolvedRequest,
  };
}
return {
  status: "err",
  httpStatus,
  elapsedMs,
  response: body,
  error: `HTTP ${httpStatus}`,
  request: resolvedRequest,
};
```

The `catch` branch already returns `{ status: "err", ... }` without a request — leave it unchanged (no request is available when the fetch itself throws).

- [ ] **Step 2: Verify no TypeScript errors**

```bash
pnpm tsc --noEmit
```

Expected: no errors.

---

## Task 4: Snippet utilities + tests

**Files:**
- Create: `src/components/snippets.ts`
- Create: `tests/components/snippets.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/components/snippets.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
pnpm test tests/components/snippets.test.ts
```

Expected: all tests fail with "Cannot find module".

- [ ] **Step 3: Implement `src/components/snippets.ts`**

Create `src/components/snippets.ts`:

```ts
import type { ResolvedRequest } from "../blocks/types";
import type { BlockRunResult } from "../blocks/types";

const SENSITIVE = new Set(["authorization", "cookie", "x-api-key", "x-auth-token"]);

export function redactHeaders(headers: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(headers).map(([k, v]) => [
      k,
      SENSITIVE.has(k.toLowerCase()) ? "••••••••" : v,
    ])
  );
}

export function redactSnippet(snippet: string, headers: Record<string, string>): string {
  let out = snippet;
  for (const [k, v] of Object.entries(headers)) {
    if (SENSITIVE.has(k.toLowerCase()) && v) {
      out = out.split(v).join("YOUR_TOKEN");
    }
  }
  return out;
}

export function generateCurl(req: ResolvedRequest): string {
  const headerFlags = Object.entries(req.headers)
    .map(([k, v]) => `  -H '${k}: ${v}'`)
    .join(" \\\n");
  const bodyFlag =
    req.body !== undefined ? ` \\\n  --data '${JSON.stringify(req.body)}'` : "";
  return `curl -X ${req.method} '${req.url}' \\\n${headerFlags}${bodyFlag}`;
}

export function generateNodeFetch(req: ResolvedRequest): string {
  const headersLines = Object.entries(req.headers)
    .map(([k, v]) => `    "${k}": "${v}"`)
    .join(",\n");
  const bodyLine =
    req.body !== undefined
      ? `\n  body: JSON.stringify(${JSON.stringify(req.body, null, 2)}),`
      : "";
  return (
    `const res = await fetch('${req.url}', {\n` +
    `  method: '${req.method}',\n` +
    `  headers: {\n${headersLines}\n  },${bodyLine}\n` +
    `});\nconst data = await res.json();`
  );
}

export function generateAxios(req: ResolvedRequest): string {
  const method = req.method.toLowerCase();
  const headersLines = Object.entries(req.headers)
    .map(([k, v]) => `    "${k}": "${v}"`)
    .join(",\n");
  const config = `{\n  headers: {\n${headersLines}\n  },\n}`;
  if (req.body !== undefined) {
    return `const { data } = await axios.${method}('${req.url}', ${JSON.stringify(req.body, null, 2)}, ${config});`;
  }
  return `const { data } = await axios.${method}('${req.url}', ${config});`;
}

export function formatRequestResponse(req: ResolvedRequest, result: BlockRunResult): string {
  const headerLines = Object.entries(req.headers)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
  const bodySection =
    req.body !== undefined ? `\n\n${JSON.stringify(req.body, null, 2)}` : "";
  const responseBody =
    typeof result.response === "string"
      ? result.response
      : JSON.stringify(result.response, null, 2);
  const code =
    "httpStatus" in result && result.httpStatus ? result.httpStatus : "—";
  return (
    `=== REQUEST ===\n${req.method} ${req.url}\n${headerLines}${bodySection}\n\n` +
    `=== RESPONSE ===\nHTTP ${code}  (${result.elapsedMs}ms)\n${responseBody}`
  );
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
pnpm test tests/components/snippets.test.ts
```

Expected: all tests pass.

---

## Task 5: Redesign `ResponseViewer`

**Files:**
- Modify: `src/components/ResponseViewer.tsx`

- [ ] **Step 1: Replace `ResponseViewer.tsx` entirely**

```tsx
import { useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Code,
  Group,
  ScrollArea,
  SegmentedControl,
  Stack,
  Tabs,
  Text,
} from "@mantine/core";
import { IconCheck, IconCopy, IconX } from "@tabler/icons-react";
import type { BlockRunResult, ResolvedRequest } from "../blocks/types";
import {
  generateAxios,
  generateCurl,
  generateNodeFetch,
  formatRequestResponse,
  redactHeaders,
  redactSnippet,
} from "./snippets";

function ResultStatusBar({ result }: { result: BlockRunResult }) {
  const isOk = result.status === "ok";
  const code = "httpStatus" in result && result.httpStatus ? result.httpStatus : "—";
  const captured = isOk ? Object.keys(result.captured) : [];

  return (
    <Alert
      color={isOk ? "teal" : "red"}
      variant="light"
      icon={isOk ? <IconCheck size={16} /> : <IconX size={16} />}
      p="sm"
    >
      <Group gap="xs" wrap="nowrap">
        <Text size="sm" fw={600}>
          HTTP {code}
        </Text>
        <Text size="sm" c="dimmed">·</Text>
        <Text size="sm" c="dimmed">{result.elapsedMs}ms</Text>
        {result.request && (
          <>
            <Text size="sm" c="dimmed">·</Text>
            <Text size="sm" c="dimmed" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {result.request.method} {result.request.url}
            </Text>
          </>
        )}
      </Group>
      {!isOk && result.error && (
        <Text size="xs" mt={4}>{result.error}</Text>
      )}
      {isOk && captured.length > 0 && (
        <Text size="xs" mt={4} c="dimmed">
          Captured: {captured.join(", ")}
        </Text>
      )}
    </Alert>
  );
}

function RequestTab({ request }: { request?: ResolvedRequest }) {
  if (!request) {
    return (
      <Text size="sm" c="dimmed" mt="xs">
        Request details not available.
      </Text>
    );
  }
  const displayed = redactHeaders(request.headers);
  return (
    <Stack gap="xs" mt="xs">
      <Group gap="xs">
        <Badge variant="light" size="sm">
          {request.method}
        </Badge>
        <Text size="xs" ff="monospace" style={{ wordBreak: "break-all" }}>
          {request.url}
        </Text>
      </Group>
      {Object.entries(displayed).map(([k, v]) => (
        <Group key={k} gap={4}>
          <Text size="xs" fw={600} ff="monospace">{k}:</Text>
          <Text size="xs" ff="monospace">{v}</Text>
        </Group>
      ))}
      {request.body !== undefined && (
        <Code block style={{ fontSize: 12 }}>
          {JSON.stringify(request.body, null, 2)}
        </Code>
      )}
    </Stack>
  );
}

const SNIPPET_LANGS = ["curl", "Node fetch", "Axios"] as const;
type SnippetLang = (typeof SNIPPET_LANGS)[number];

function buildSnippet(lang: SnippetLang, request: ResolvedRequest): string {
  if (lang === "curl") return generateCurl(request);
  if (lang === "Node fetch") return generateNodeFetch(request);
  return generateAxios(request);
}

function CodeTab({ request }: { request?: ResolvedRequest }) {
  const [lang, setLang] = useState<SnippetLang>("curl");

  if (!request) {
    return (
      <Text size="sm" c="dimmed" mt="xs">
        Request details not available.
      </Text>
    );
  }

  const realSnippet = buildSnippet(lang, request);
  const displaySnippet = redactSnippet(realSnippet, request.headers);

  return (
    <Stack gap="xs" mt="xs">
      <Group justify="space-between">
        <SegmentedControl
          size="xs"
          value={lang}
          onChange={(v) => setLang(v as SnippetLang)}
          data={[...SNIPPET_LANGS]}
        />
        <Button
          variant="subtle"
          size="xs"
          leftSection={<IconCopy size={14} />}
          onClick={() => navigator.clipboard.writeText(realSnippet)}
        >
          Copy
        </Button>
      </Group>
      <ScrollArea>
        <Code block style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 12 }}>
          {displaySnippet}
        </Code>
      </ScrollArea>
    </Stack>
  );
}

export function ResponseViewer({ result }: { result: BlockRunResult | null }) {
  if (!result) return null;

  const responseText =
    typeof result.response === "string"
      ? result.response
      : JSON.stringify(result.response, null, 2);

  return (
    <Stack gap="xs" mt="xs">
      <ResultStatusBar result={result} />
      <Tabs defaultValue="response">
        <Group justify="space-between" align="center" wrap="nowrap">
          <Tabs.List>
            <Tabs.Tab value="response">Response</Tabs.Tab>
            <Tabs.Tab value="request">Request</Tabs.Tab>
            <Tabs.Tab value="code">Code</Tabs.Tab>
          </Tabs.List>
          {result.request && (
            <Button
              variant="subtle"
              size="xs"
              leftSection={<IconCopy size={14} />}
              onClick={() =>
                navigator.clipboard.writeText(
                  formatRequestResponse(result.request!, result)
                )
              }
            >
              Copy request+response
            </Button>
          )}
        </Group>
        <Tabs.Panel value="response">
          <ScrollArea h={300} mt="xs">
            <Code
              block
              style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 12 }}
            >
              {responseText}
            </Code>
          </ScrollArea>
        </Tabs.Panel>
        <Tabs.Panel value="request">
          <RequestTab request={result.request} />
        </Tabs.Panel>
        <Tabs.Panel value="code">
          <CodeTab request={result.request} />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
```

- [ ] **Step 2: Check TypeScript**

```bash
pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Run full test suite**

```bash
pnpm test
```

Expected: all tests pass (including the new snippet tests).

- [ ] **Step 4: Start dev server and verify in browser**

```bash
pnpm dev
```

Open a scenario, run a block that succeeds and one that fails. Verify:
- Status bar shows correct color, HTTP code, timing, and URL
- Response tab shows the JSON body
- Request tab shows headers with `••••••••` for Authorization
- Code tab shows curl/Node/Axios snippets with `YOUR_TOKEN` in display
- Copy button on Code tab copies real token to clipboard
- "Copy request+response" copies real token in the Authorization header
- Success shows "Captured: ..." line in status bar
