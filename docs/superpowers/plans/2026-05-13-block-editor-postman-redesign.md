# Block Editor & Runner — Postman-Style Params Redesign

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **Note:** User has requested no git commits for this session — skip all commit steps.

**Goal:** Replace the flat input list and split URL/query fields with a Postman-style interface where a single URL bar drives auto-generated path/query/body param sections, and the runner shows inputs grouped by location with a live URL preview.

**Architecture:** A new pure-utility module `urlTemplate.ts` parses `{{token}}` names from URL path, query string, and body template. `BlockEditorModal` uses these parsers to sync its `inputs` state live as the user types in the URL bar, replacing manual query K-V rows and the hand-managed inputs list. `BlockForm` groups inputs by a new optional `location` field on `FieldSpec` and shows a live URL preview when `def.urlTemplate` is set. Built-in hardcoded blocks (no `location`, no `urlTemplate`) continue to render a flat list unchanged.

**Tech Stack:** React 18, TypeScript, Mantine v7, Vitest, Zod

---

## File Structure

| File | Role |
|---|---|
| `src/blocks/urlTemplate.ts` | New: pure URL parsing and preview utilities |
| `tests/blocks/urlTemplate.test.ts` | New: unit tests for urlTemplate utilities |
| `src/blocks/types.ts` | Add `location?` to `FieldSpec`; add `urlTemplate?` and `method?` to `BlockDef` |
| `src/blocks/dataBlock.ts` | Keep `query` optional (migration); import urlTemplate utils; update `dataDefToBlockDef` to derive `location` per input and set `urlTemplate`/`method` on returned `BlockDef` |
| `src/components/BlockEditorModal.tsx` | Postman-style URL bar + auto-synced param rows replacing manual query/inputs sections |
| `src/components/BlockForm.tsx` | URL preview bar + grouped param sections; flat fallback for built-in blocks |

---

## Task 1: URL Template Utilities

**Files:**
- Create: `src/blocks/urlTemplate.ts`
- Create: `tests/blocks/urlTemplate.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/blocks/urlTemplate.test.ts
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
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /Users/xuantruong/Documents/WORK/32CO/test-fe
pnpm test tests/blocks/urlTemplate.test.ts
```

Expected: all tests FAIL with "Cannot find module"

- [ ] **Step 3: Implement urlTemplate.ts**

```typescript
// src/blocks/urlTemplate.ts

const TOKEN_RE = /\{\{([^}]+)\}\}/g;

export function parsePathTokens(urlTemplate: string): string[] {
  const path = urlTemplate.split("?")[0];
  const tokens: string[] = [];
  const re = new RegExp(TOKEN_RE.source, "g");
  let match: RegExpExecArray | null;
  while ((match = re.exec(path)) !== null) {
    if (!tokens.includes(match[1])) tokens.push(match[1]);
  }
  return tokens;
}

export function parseQueryEntries(urlTemplate: string): Array<{ key: string; token: string }> {
  const queryPart = urlTemplate.split("?")[1] ?? "";
  if (!queryPart) return [];
  const entries: Array<{ key: string; token: string }> = [];
  for (const part of queryPart.split("&")) {
    const eqIdx = part.indexOf("=");
    if (eqIdx === -1) continue;
    const key = part.slice(0, eqIdx);
    const value = part.slice(eqIdx + 1);
    const tokenMatch = /^\{\{([^}]+)\}\}$/.exec(value);
    if (tokenMatch && key) {
      entries.push({ key, token: tokenMatch[1] });
    }
  }
  return entries;
}

export function parseBodyTokens(bodyTemplate: unknown): string[] {
  const tokens: string[] = [];
  collectTokens(bodyTemplate, tokens);
  return tokens;
}

function collectTokens(value: unknown, out: string[]): void {
  if (typeof value === "string") {
    const re = new RegExp(TOKEN_RE.source, "g");
    let match: RegExpExecArray | null;
    while ((match = re.exec(value)) !== null) {
      if (!out.includes(match[1])) out.push(match[1]);
    }
  } else if (Array.isArray(value)) {
    for (const item of value) collectTokens(item, out);
  } else if (value !== null && typeof value === "object") {
    for (const v of Object.values(value as Record<string, unknown>)) collectTokens(v, out);
  }
}

export function previewUrl(urlTemplate: string, values: Record<string, unknown>): string {
  return urlTemplate.replace(/\{\{([^}]+)\}\}/g, (_full, name: string) => {
    const v = values[name];
    return v !== undefined && v !== "" ? String(v) : `{{${name}}}`;
  });
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
pnpm test tests/blocks/urlTemplate.test.ts
```

Expected: all 20 tests PASS

---

## Task 2: Extend Types

**Files:**
- Modify: `src/blocks/types.ts`

- [ ] **Step 1: Add `location` to `FieldSpec` and `urlTemplate`/`method` to `BlockDef`**

Replace the `FieldSpec` and `BlockDef` types in `src/blocks/types.ts`:

```typescript
export type FieldSpec = {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  fromContextKey?: string;
  enumValues?: readonly string[];
  placeholder?: string;
  location?: "path" | "query" | "body" | "header";
};
```

```typescript
export type BlockDef = {
  kind: string;
  label: string;
  inputs: FieldSpec[];
  outputs: OutputSpec[];
  auth: AuthMode;
  urlTemplate?: string;
  method?: string;
  build: (values: Record<string, unknown>) => HttpRequest;
};
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
pnpm tsc --noEmit
```

Expected: 0 errors

---

## Task 3: Update `dataBlock.ts`

**Files:**
- Modify: `src/blocks/dataBlock.ts`

The goals:
1. Add `location` to `FieldSpecSchema`
2. Keep `query` in `RequestSchema` as `.optional()` (backward compat)
3. Import `parsePathTokens`, `parseQueryEntries`, `parseBodyTokens` from `urlTemplate.ts`
4. In `dataDefToBlockDef`: merge old `query` into URL, derive `location` per input, set `urlTemplate`/`method` on returned `BlockDef`, replace the old `query`-processing loop in `build()` with query-string parsing from the merged URL

- [ ] **Step 1: Update `FieldSpecSchema` to accept `location`**

In `src/blocks/dataBlock.ts`, replace `FieldSpecSchema`:

```typescript
const FieldSpecSchema = z.object({
  name: z.string(),
  label: z.string(),
  type: FieldTypeSchema,
  required: z.boolean().optional(),
  fromContextKey: z.string().optional(),
  enumValues: z.array(z.string()).optional(),
  placeholder: z.string().optional(),
  location: z.enum(["path", "query", "body", "header"]).optional(),
});
```

- [ ] **Step 2: Keep `query` optional in `RequestSchema`**

`RequestSchema` already has `query: z.record(z.string(), z.string()).optional()` — no change needed. Confirm it's optional and leave it as-is.

- [ ] **Step 3: Import urlTemplate utilities**

At the top of `src/blocks/dataBlock.ts`, add:

```typescript
import { parsePathTokens, parseQueryEntries, parseBodyTokens } from "./urlTemplate";
```

- [ ] **Step 4: Rewrite `dataDefToBlockDef`**

Replace the entire `dataDefToBlockDef` function:

```typescript
export function dataDefToBlockDef(
  data: BlockDefData,
  opts: { resolveBaseUrl: () => string }
): BlockDef {
  // Migrate old-format query record into the URL template
  let mergedUrl = data.request.urlTemplate;
  if (data.request.query && Object.keys(data.request.query).length > 0) {
    const queryStr = Object.entries(data.request.query)
      .map(([k, v]) => `${encodeURIComponent(k)}=${v}`)
      .join("&");
    const sep = mergedUrl.includes("?") ? "&" : "?";
    mergedUrl = mergedUrl + sep + queryStr;
  }

  // Derive location for each input from where its token appears
  const pathSet = new Set(parsePathTokens(mergedUrl));
  const querySet = new Set(parseQueryEntries(mergedUrl).map((e) => e.token));
  const bodySet = new Set(
    data.request.bodyTemplate ? parseBodyTokens(data.request.bodyTemplate) : []
  );

  const inputs: FieldSpec[] = data.inputs.map((inp) => ({
    ...inp,
    location:
      inp.location ??
      (pathSet.has(inp.name)
        ? "path"
        : querySet.has(inp.name)
        ? "query"
        : bodySet.has(inp.name)
        ? "body"
        : undefined),
  }));

  function build(values: Record<string, unknown>): HttpRequest {
    // 1. Resolve path
    const pathPart = mergedUrl.split("?")[0];
    const resolvedPath = substituteTemplate(pathPart, values) as string;
    let url = `${opts.resolveBaseUrl()}${resolvedPath}`;

    // 2. Resolve query params from URL template
    const queryEntries = parseQueryEntries(mergedUrl);
    if (queryEntries.length > 0) {
      const params: string[] = [];
      for (const { key, token } of queryEntries) {
        const resolved = values[token];
        if (resolved === undefined || resolved === "") continue;
        params.push(
          `${encodeURIComponent(key)}=${encodeURIComponent(String(resolved))}`
        );
      }
      if (params.length > 0) {
        const sep = url.includes("?") ? "&" : "?";
        url = `${url}${sep}${params.join("&")}`;
      }
    }

    // 3. Resolve headers
    const headers: Record<string, string> = {};
    if (data.request.headers) {
      for (const [key, tpl] of Object.entries(data.request.headers)) {
        const resolved = substituteTemplate(tpl, values);
        if (resolved === undefined || resolved === "") continue;
        headers[key] = String(resolved);
      }
    }

    // 4. Resolve body
    if (data.request.bodyTemplate === undefined) {
      return { method: data.request.method, url, headers };
    }
    const body = substituteTemplate(data.request.bodyTemplate, values);
    if (body === undefined) {
      return { method: data.request.method, url, headers };
    }
    return { method: data.request.method, url, headers, body };
  }

  return {
    kind: data.kind,
    label: data.label,
    auth: data.auth,
    inputs,
    outputs: data.outputs,
    urlTemplate: mergedUrl,
    method: data.request.method,
    build,
  };
}
```

- [ ] **Step 5: Run full test suite**

```bash
pnpm test
```

Expected: all existing tests still pass (no regressions)

- [ ] **Step 6: Verify TypeScript compiles**

```bash
pnpm tsc --noEmit
```

Expected: 0 errors

---

## Task 4: Redesign `BlockEditorModal.tsx`

**Files:**
- Modify: `src/components/BlockEditorModal.tsx`

Key changes vs current:
- `InputDraft` gets a `location` field
- Separate "Query Params" K-V section is **removed**
- Separate flat "Inputs" section is **removed**
- URL bar triggers `syncInputs()` which auto-generates `inputs` state
- Body template changes also trigger `syncInputs()`
- Three auto-generated sections replace the old inputs: Path Params, Query Params, Body Params

- [ ] **Step 1: Replace the file with the new implementation**

```typescript
// src/components/BlockEditorModal.tsx
import { useEffect, useState } from "react";
import {
  Modal,
  ScrollArea,
  Stack,
  Group,
  Text,
  TextInput,
  Textarea,
  Select,
  SegmentedControl,
  Checkbox,
  Button,
  ActionIcon,
  Paper,
} from "@mantine/core";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import type { BlockDefData } from "../blocks/dataBlock";
import { parsePathTokens, parseQueryEntries, parseBodyTokens } from "../blocks/urlTemplate";

type JsonTemplateValue =
  | string
  | number
  | boolean
  | null
  | JsonTemplateValue[]
  | { [key: string]: JsonTemplateValue };

type KVEntry = { key: string; value: string };

type InputDraft = {
  name: string;
  label: string;
  type: string;
  required: boolean;
  fromContextKey: string;
  enumValues: string;
  placeholder: string;
  location: "path" | "query" | "body";
};

type OutputDraft = {
  jsonPath: string;
  contextKey: string;
};

type Props = {
  opened: boolean;
  onClose: () => void;
  initial?: BlockDefData;
  existingKinds: string[];
  onSave: (block: BlockDefData) => void;
};

function makeEmptyOutput(): OutputDraft {
  return { jsonPath: "", contextKey: "" };
}

function makeEmptyKV(): KVEntry {
  return { key: "", value: "" };
}

/** Sync inputs state from URL template + body template.
 *  Preserves label/type/fromContextKey for tokens that already exist.
 *  Tokens appearing in both path and query (unusual) — path takes precedence.
 */
function syncInputs(
  urlTemplate: string,
  bodyTemplateStr: string,
  prevInputs: InputDraft[]
): InputDraft[] {
  const pathTokens = parsePathTokens(urlTemplate);
  const queryTokens = parseQueryEntries(urlTemplate).map((e) => e.token);

  let bodyTokens: string[] = [];
  if (bodyTemplateStr.trim()) {
    try {
      bodyTokens = parseBodyTokens(JSON.parse(bodyTemplateStr));
    } catch {
      // invalid JSON while typing — keep previous body tokens
      bodyTokens = prevInputs
        .filter((i) => i.location === "body")
        .map((i) => i.name);
    }
  }

  const seen = new Set<string>();
  const desired: Array<{ name: string; location: "path" | "query" | "body" }> = [];

  for (const t of pathTokens) {
    if (!seen.has(t)) { seen.add(t); desired.push({ name: t, location: "path" }); }
  }
  for (const t of queryTokens) {
    if (!seen.has(t)) { seen.add(t); desired.push({ name: t, location: "query" }); }
  }
  for (const t of bodyTokens) {
    if (!seen.has(t)) { seen.add(t); desired.push({ name: t, location: "body" }); }
  }

  return desired.map(({ name, location }) => {
    const existing = prevInputs.find((i) => i.name === name);
    return existing
      ? { ...existing, location }
      : {
          name,
          label: name,
          type: "string",
          required: false,
          fromContextKey: "",
          enumValues: "",
          placeholder: "",
          location,
        };
  });
}

function ParamRow({
  inp,
  onUpdate,
}: {
  inp: InputDraft;
  onUpdate: (patch: Partial<InputDraft>) => void;
}) {
  return (
    <Group gap="xs" align="flex-end">
      <Text size="xs" c="dimmed" ff="monospace" w={160} pb={6}>
        {`{{${inp.name}}}`}
      </Text>
      <TextInput
        label="Label"
        value={inp.label}
        onChange={(e) => onUpdate({ label: e.currentTarget.value })}
        style={{ flex: 1 }}
      />
      <Select
        label="Type"
        value={inp.type}
        onChange={(v) => onUpdate({ type: v ?? "string" })}
        data={["string", "password", "number", "enum", "json"]}
        w={120}
      />
      <TextInput
        label="From context"
        value={inp.fromContextKey}
        onChange={(e) => onUpdate({ fromContextKey: e.currentTarget.value })}
        style={{ flex: 1 }}
      />
      {inp.type === "enum" && (
        <TextInput
          label="Enum values (comma-separated)"
          value={inp.enumValues}
          onChange={(e) => onUpdate({ enumValues: e.currentTarget.value })}
          style={{ flex: 2 }}
        />
      )}
    </Group>
  );
}

function ParamSection({
  title,
  inputs,
  onUpdate,
}: {
  title: string;
  inputs: InputDraft[];
  onUpdate: (name: string, patch: Partial<InputDraft>) => void;
}) {
  if (inputs.length === 0) return null;
  return (
    <Stack gap="xs">
      <Text size="xs" fw={600} c="dimmed">
        {title}
      </Text>
      {inputs.map((inp) => (
        <ParamRow key={inp.name} inp={inp} onUpdate={(patch) => onUpdate(inp.name, patch)} />
      ))}
    </Stack>
  );
}

export function BlockEditorModal({
  opened,
  onClose,
  initial,
  existingKinds,
  onSave,
}: Props) {
  const isEditing = initial !== undefined;

  const [kind, setKind] = useState("");
  const [label, setLabel] = useState("");
  const [auth, setAuth] = useState<string>("none");
  const [method, setMethod] = useState("GET");
  const [urlTemplate, setUrlTemplate] = useState("");
  const [headers, setHeaders] = useState<KVEntry[]>([]);
  const [bodyTemplate, setBodyTemplate] = useState("");
  const [inputs, setInputs] = useState<InputDraft[]>([]);
  const [outputs, setOutputs] = useState<OutputDraft[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!opened) return;
    if (initial) {
      // Merge old query params into URL for migration
      let mergedUrl = initial.request.urlTemplate;
      if (initial.request.query && Object.keys(initial.request.query).length > 0) {
        const queryStr = Object.entries(initial.request.query)
          .map(([k, v]) => `${encodeURIComponent(k)}=${v}`)
          .join("&");
        const sep = mergedUrl.includes("?") ? "&" : "?";
        mergedUrl = mergedUrl + sep + queryStr;
      }

      const bodyStr =
        initial.request.bodyTemplate !== undefined
          ? JSON.stringify(initial.request.bodyTemplate, null, 2)
          : "";

      // Seed InputDraft from existing inputs, then re-derive location from URL
      const seedInputs: InputDraft[] = initial.inputs.map((inp) => ({
        name: inp.name,
        label: inp.label,
        type: inp.type,
        required: inp.required ?? false,
        fromContextKey: inp.fromContextKey ?? "",
        enumValues: inp.enumValues ? inp.enumValues.join(", ") : "",
        placeholder: inp.placeholder ?? "",
        location: (inp.location as "path" | "query" | "body") ?? "body",
      }));

      setKind(initial.kind);
      setLabel(initial.label);
      setAuth(initial.auth);
      setMethod(initial.request.method);
      setUrlTemplate(mergedUrl);
      setHeaders(
        initial.request.headers
          ? Object.entries(initial.request.headers).map(([key, value]) => ({ key, value }))
          : []
      );
      setBodyTemplate(bodyStr);
      setInputs(syncInputs(mergedUrl, bodyStr, seedInputs));
      setOutputs(initial.outputs.map((o) => ({ jsonPath: o.jsonPath, contextKey: o.contextKey })));
    } else {
      setKind("");
      setLabel("");
      setAuth("none");
      setMethod("GET");
      setUrlTemplate("");
      setHeaders([]);
      setBodyTemplate("");
      setInputs([]);
      setOutputs([]);
    }
    setError(null);
  }, [opened, initial]);

  function handleUrlChange(v: string) {
    setUrlTemplate(v);
    setInputs((prev) => syncInputs(v, bodyTemplate, prev));
  }

  function handleBodyChange(v: string) {
    setBodyTemplate(v);
    setInputs((prev) => syncInputs(urlTemplate, v, prev));
  }

  function updateInput(name: string, patch: Partial<InputDraft>) {
    setInputs((all) => all.map((i) => (i.name === name ? { ...i, ...patch } : i)));
  }

  function handleSave() {
    setError(null);

    if (!kind.trim()) { setError("Kind is required."); return; }
    if (!label.trim()) { setError("Label is required."); return; }
    if (!urlTemplate.trim()) { setError("URL template is required."); return; }

    if (!isEditing && existingKinds.includes(kind.trim())) {
      setError(`A block with kind "${kind.trim()}" already exists.`);
      return;
    }

    let parsedBody: JsonTemplateValue | undefined = undefined;
    if (bodyTemplate.trim()) {
      try {
        parsedBody = JSON.parse(bodyTemplate.trim()) as JsonTemplateValue;
      } catch {
        setError("Body template is not valid JSON.");
        return;
      }
    }

    const headersRecord: Record<string, string> = {};
    for (const { key, value } of headers) {
      if (key.trim()) headersRecord[key.trim()] = value;
    }

    const blockDef: BlockDefData = {
      kind: kind.trim(),
      label: label.trim(),
      auth: auth as BlockDefData["auth"],
      inputs: inputs.map((inp) => ({
        name: inp.name,
        label: inp.label,
        type: inp.type as BlockDefData["inputs"][number]["type"],
        location: inp.location,
        ...(inp.required ? { required: true } : {}),
        ...(inp.fromContextKey.trim() ? { fromContextKey: inp.fromContextKey.trim() } : {}),
        ...(inp.placeholder.trim() ? { placeholder: inp.placeholder.trim() } : {}),
        ...(inp.type === "enum" && inp.enumValues.trim()
          ? {
              enumValues: inp.enumValues
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            }
          : {}),
      })),
      outputs: outputs.map((o) => ({ jsonPath: o.jsonPath, contextKey: o.contextKey })),
      request: {
        method: method as BlockDefData["request"]["method"],
        urlTemplate: urlTemplate.trim(),
        ...(Object.keys(headersRecord).length > 0 ? { headers: headersRecord } : {}),
        ...(parsedBody !== undefined ? { bodyTemplate: parsedBody } : {}),
      },
    };

    onSave(blockDef);
    onClose();
  }

  function updateKV(
    list: KVEntry[],
    setList: (v: KVEntry[]) => void,
    idx: number,
    field: "key" | "value",
    val: string
  ) {
    setList(list.map((item, i) => (i === idx ? { ...item, [field]: val } : item)));
  }

  function removeKV(list: KVEntry[], setList: (v: KVEntry[]) => void, idx: number) {
    setList(list.filter((_, i) => i !== idx));
  }

  function updateOutput(idx: number, patch: Partial<OutputDraft>) {
    setOutputs((all) => all.map((item, i) => (i === idx ? { ...item, ...patch } : item)));
  }

  function removeOutput(idx: number) {
    setOutputs((all) => all.filter((_, i) => i !== idx));
  }

  const showBody = method === "POST" || method === "PUT";
  const pathInputs = inputs.filter((i) => i.location === "path");
  const queryInputs = inputs.filter((i) => i.location === "query");
  const bodyInputs = inputs.filter((i) => i.location === "body");

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={isEditing ? `Edit block: ${initial?.kind}` : "New API Block"}
      size="xl"
    >
      <ScrollArea mah="70vh" offsetScrollbars>
        <Stack gap="md">
          {/* General */}
          <Text size="sm" fw={600} c="dimmed">
            General
          </Text>
          <Group grow>
            <TextInput
              label="Kind"
              value={kind}
              onChange={(e) => setKind(e.currentTarget.value)}
              disabled={isEditing}
              placeholder="my-api-block"
            />
            <TextInput
              label="Label"
              value={label}
              onChange={(e) => setLabel(e.currentTarget.value)}
              placeholder="My API Block"
            />
          </Group>
          <Select
            label="Auth"
            value={auth}
            onChange={(v) => setAuth(v ?? "none")}
            data={[
              { value: "none", label: "None" },
              { value: "jwt", label: "JWT" },
              { value: "cookie-or-jwt", label: "Cookie or JWT" },
            ]}
            w={220}
          />

          {/* URL Bar */}
          <Text size="sm" fw={600} c="dimmed">
            Request
          </Text>
          <Group align="flex-end" gap="xs">
            <div>
              <Text size="sm" mb={4}>
                Method
              </Text>
              <SegmentedControl
                value={method}
                onChange={setMethod}
                data={["GET", "POST", "PUT", "DELETE"]}
                size="xs"
              />
            </div>
            <TextInput
              label="URL"
              value={urlTemplate}
              onChange={(e) => handleUrlChange(e.currentTarget.value)}
              placeholder="/api/v1/users/{{userId}}?sort={{sort}}"
              style={{ flex: 1 }}
              description="Use {{tokenName}} for path params; ?key={{token}} for query params"
            />
          </Group>

          {/* Auto-generated param sections */}
          <ParamSection
            title="Path Params"
            inputs={pathInputs}
            onUpdate={updateInput}
          />
          <ParamSection
            title="Query Params"
            inputs={queryInputs}
            onUpdate={updateInput}
          />

          {/* Headers */}
          <Text size="sm" fw={600} c="dimmed">
            Headers
          </Text>
          <Stack gap="xs">
            {headers.map((h, i) => (
              <Group key={i} gap="xs">
                <TextInput
                  placeholder="Header name"
                  value={h.key}
                  onChange={(e) =>
                    updateKV(headers, setHeaders, i, "key", e.currentTarget.value)
                  }
                  style={{ flex: 1 }}
                />
                <TextInput
                  placeholder="Value or {{token}}"
                  value={h.value}
                  onChange={(e) =>
                    updateKV(headers, setHeaders, i, "value", e.currentTarget.value)
                  }
                  style={{ flex: 1 }}
                />
                <ActionIcon
                  aria-label="Remove header"
                  color="red"
                  variant="subtle"
                  onClick={() => removeKV(headers, setHeaders, i)}
                >
                  <IconTrash size={16} />
                </ActionIcon>
              </Group>
            ))}
            <Button
              variant="default"
              size="xs"
              leftSection={<IconPlus size={14} />}
              onClick={() => setHeaders((h) => [...h, makeEmptyKV()])}
              w="fit-content"
            >
              Add header
            </Button>
          </Stack>

          {/* Body — only for POST/PUT */}
          {showBody && (
            <>
              <Text size="sm" fw={600} c="dimmed">
                Body
              </Text>
              <Textarea
                rows={5}
                value={bodyTemplate}
                onChange={(e) => handleBodyChange(e.currentTarget.value)}
                placeholder={'{\n  "key": "{{value}}"\n}'}
                styles={{ input: { fontFamily: "monospace" } }}
                description="Use {{tokenName}} for dynamic values"
              />
              <ParamSection
                title="Body Params"
                inputs={bodyInputs}
                onUpdate={updateInput}
              />
            </>
          )}

          {/* Outputs */}
          <Text size="sm" fw={600} c="dimmed">
            Outputs
          </Text>
          <Stack gap="xs">
            {outputs.map((o, i) => (
              <Group key={i} gap="xs">
                <TextInput
                  placeholder="data.token"
                  value={o.jsonPath}
                  onChange={(e) => updateOutput(i, { jsonPath: e.currentTarget.value })}
                  style={{ flex: 1 }}
                  label={i === 0 ? "JSON Path" : undefined}
                />
                <TextInput
                  placeholder="ctx.authToken"
                  value={o.contextKey}
                  onChange={(e) => updateOutput(i, { contextKey: e.currentTarget.value })}
                  style={{ flex: 1 }}
                  label={i === 0 ? "Context Key" : undefined}
                />
                <ActionIcon
                  aria-label="Remove output"
                  color="red"
                  variant="subtle"
                  mt={i === 0 ? 24 : 0}
                  onClick={() => removeOutput(i)}
                >
                  <IconTrash size={16} />
                </ActionIcon>
              </Group>
            ))}
            <Button
              variant="default"
              size="xs"
              leftSection={<IconPlus size={14} />}
              onClick={() => setOutputs((all) => [...all, makeEmptyOutput()])}
              w="fit-content"
            >
              Add output
            </Button>
          </Stack>

          {error && (
            <Text c="red" size="sm">
              {error}
            </Text>
          )}

          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave}>Save</Button>
          </Group>
        </Stack>
      </ScrollArea>
    </Modal>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
pnpm tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 3: Run full test suite**

```bash
pnpm test
```

Expected: all tests pass

---

## Task 5: Redesign `BlockForm.tsx`

**Files:**
- Modify: `src/components/BlockForm.tsx`

Key changes:
- Import `previewUrl` from `urlTemplate.ts`
- Show URL preview bar when `def.urlTemplate` is set
- Group inputs by `location` when any have it; flat list fallback otherwise

- [ ] **Step 1: Replace the file with the new implementation**

```typescript
// src/components/BlockForm.tsx
import {
  Badge,
  Group,
  JsonInput,
  NumberInput,
  Paper,
  PasswordInput,
  Select,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import type { BlockDef, FieldSpec, RuntimeContext } from "../blocks/types";
import { previewUrl } from "../blocks/urlTemplate";

type Props = {
  def: BlockDef;
  overrides: Record<string, unknown>;
  context: RuntimeContext;
  onChange: (overrides: Record<string, unknown>) => void;
};

function Field({
  field,
  overrides,
  context,
  onChange,
}: { field: FieldSpec } & Omit<Props, "def">) {
  const override = overrides[field.name];
  const ctxVal = field.fromContextKey ? context[field.fromContextKey] : undefined;
  const effective = override !== undefined && override !== "" ? override : ctxVal ?? "";
  const usingContext = (override === undefined || override === "") && ctxVal !== undefined;

  function update(value: string) {
    onChange({ ...overrides, [field.name]: value });
  }

  const label = usingContext ? (
    <Group gap={6}>
      {field.label}
      <Badge size="xs" variant="light" color="violet">
        ← context: {field.fromContextKey}
      </Badge>
    </Group>
  ) : (
    field.label
  );

  if (field.type === "enum") {
    return (
      <Select
        label={label}
        placeholder={field.placeholder ?? "— select —"}
        value={String(effective)}
        onChange={(v) => update(v ?? "")}
        data={field.enumValues ? [...field.enumValues] : []}
        allowDeselect={false}
      />
    );
  }

  if (field.type === "password") {
    return (
      <PasswordInput
        label={label}
        placeholder={field.placeholder}
        value={String(effective)}
        onChange={(e) => update(e.currentTarget.value)}
      />
    );
  }

  if (field.type === "number") {
    return (
      <NumberInput
        label={label}
        placeholder={field.placeholder}
        value={effective === "" ? "" : Number(effective)}
        onChange={(v) => update(v === "" ? "" : String(v))}
      />
    );
  }

  if (field.type === "json") {
    return (
      <JsonInput
        label={label}
        placeholder={field.placeholder}
        value={String(effective)}
        onChange={(v) => update(v)}
        autosize
        minRows={3}
        formatOnBlur
      />
    );
  }

  return (
    <TextInput
      label={label}
      placeholder={field.placeholder}
      value={String(effective)}
      onChange={(e) => update(e.currentTarget.value)}
    />
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <Text size="xs" fw={600} c="dimmed" mt="xs">
      {children}
    </Text>
  );
}

export function BlockForm({ def, overrides, context, onChange }: Props) {
  const hasLocations = def.inputs.some((f) => f.location);
  const allValues = { ...context, ...overrides } as Record<string, unknown>;

  const urlPreview = def.urlTemplate ? previewUrl(def.urlTemplate, allValues) : null;

  if (def.inputs.length === 0 && !urlPreview) {
    return (
      <Text size="xs" c="dimmed">
        No inputs.
      </Text>
    );
  }

  return (
    <Stack gap="sm">
      {/* URL preview bar */}
      {urlPreview && (
        <Paper withBorder p="xs" bg="dark.8">
          <Group gap="xs" wrap="nowrap">
            {def.method && (
              <Badge variant="light" color="violet" size="sm">
                {def.method}
              </Badge>
            )}
            <Text size="xs" ff="monospace" c="dimmed" style={{ wordBreak: "break-all" }}>
              {urlPreview}
            </Text>
          </Group>
        </Paper>
      )}

      {/* Flat list for built-in blocks (no location set on any field) */}
      {!hasLocations &&
        def.inputs.map((f) => (
          <Field key={f.name} field={f} overrides={overrides} context={context} onChange={onChange} />
        ))}

      {/* Grouped sections for data-driven blocks */}
      {hasLocations && (() => {
        const pathFields = def.inputs.filter((f) => f.location === "path");
        const queryFields = def.inputs.filter((f) => f.location === "query");
        const bodyFields = def.inputs.filter((f) => f.location === "body");
        const otherFields = def.inputs.filter((f) => !f.location || f.location === "header");

        return (
          <>
            {pathFields.length > 0 && (
              <>
                <SectionLabel>Path Params</SectionLabel>
                {pathFields.map((f) => (
                  <Field key={f.name} field={f} overrides={overrides} context={context} onChange={onChange} />
                ))}
              </>
            )}
            {queryFields.length > 0 && (
              <>
                <SectionLabel>Query Params</SectionLabel>
                {queryFields.map((f) => (
                  <Field key={f.name} field={f} overrides={overrides} context={context} onChange={onChange} />
                ))}
              </>
            )}
            {bodyFields.length > 0 && (
              <>
                <SectionLabel>Body</SectionLabel>
                {bodyFields.map((f) => (
                  <Field key={f.name} field={f} overrides={overrides} context={context} onChange={onChange} />
                ))}
              </>
            )}
            {otherFields.length > 0 &&
              otherFields.map((f) => (
                <Field key={f.name} field={f} overrides={overrides} context={context} onChange={onChange} />
              ))}
          </>
        );
      })()}
    </Stack>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
pnpm tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 3: Run full test suite**

```bash
pnpm test
```

Expected: all tests pass (including the 20 new urlTemplate tests)

- [ ] **Step 4: Start dev server and verify visually**

```bash
pnpm dev
```

Open a scenario with a data-driven block. Verify:
- URL preview bar appears showing the template with values filled in (unfilled tokens remain as `{{token}}`)
- Inputs are grouped into Path Params / Query Params / Body sections
- Built-in blocks (signin, profile, etc.) still render the old flat list — no regressions
- BlockEditorModal: typing `{{id}}` in the URL bar auto-generates a Path Params row; typing `?key={{val}}` auto-generates a Query Params row; changing method to POST and adding a body template auto-generates Body Params rows
