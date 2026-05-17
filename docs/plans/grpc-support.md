# Plan — gRPC support (Proto → blocks + gRPC fetcher)

**Goal:** Make Runbook a useful tool for repos that expose gRPC alongside HTTP
(cworld-be is the motivating example, with `proto/cwgame_api.proto` at 87KB).
After this lands, a user can drop a `.proto` file into Runbook and get one
block per RPC method, with the same run/scenario/share UX as HTTP blocks.

## Scope of the prototype

- Server-side reflection support is **out of scope** for v1. We rely on a
  user-supplied `.proto` file (or a directory of them).
- Streaming (server-streaming, client-streaming, bi-di) is **out of scope** for
  v1 — only unary RPCs.
- TLS handshake config and per-call auth metadata (Bearer, custom headers) **in
  scope**.

## File layout (new + changed)

```
packages/shared/src/
├─ runtime/
│  └─ types.ts                           CHANGE: extend BlockDef to allow `kind: 'grpc'`
│                                                + new GrpcFetcher type
│
├─ grpc/                                 NEW directory
│  ├─ index.ts                           Barrel
│  ├─ types.ts                           GrpcMethodSpec, GrpcCallRequest, GrpcCallResult
│  ├─ fetcher.ts                         defaultGrpcFetcher using @grpc/grpc-js + @grpc/proto-loader
│  ├─ resolver.ts                        Resolve protoset → service/method descriptors
│  └─ runner.ts                          runGrpcBlock — analogue of runBlock for HTTP
│
└─ import/
   └─ proto.ts                           NEW: parse `.proto` → BlockDefData[]
                                              one block per unary RPC
                                              maps request/response messages → input fields

packages/shared/tests/
├─ grpc/
│  ├─ fetcher.test.ts                    Mock @grpc/grpc-js client, assert metadata + payload
│  └─ resolver.test.ts                   Round-trip proto → descriptors
└─ import/
   └─ proto.test.ts                      Fixture: simple .proto with 2 services → 5 blocks

apps/web/src/
├─ blocks/
│  ├─ types.ts                           CHANGE: BlockKind union add 'grpc'
│  └─ grpcBlock.ts                       NEW: render grpc block in scenarios
│
├─ features/
│  └─ import/
│     ├─ ProtoImportPanel.tsx            NEW: drop .proto file, preview methods, import
│     └─ proto-discovery.ts              NEW: scan filesystem for .proto via File API
│
└─ components/
   └─ BlockDefsPanel.tsx                 CHANGE: badge for kind=grpc

packages/cli/src/
├─ commands/
│  └─ import.ts                          CHANGE: add `rb import proto <path>` subcommand
└─ runtime/
   └─ fetcher.ts                         CHANGE: wire defaultGrpcFetcher into CLI runs

docs/
└─ grpc.md                               NEW: end-user docs — how to import a .proto,
                                              what's supported, troubleshooting
```

## Bundle format changes

`BlockDefDataSchema` already abstracts request via `request: RequestSchema`. We
need a discriminated union:

```ts
const HttpRequestSchema = z.object({ kind: z.literal('http'), method, urlTemplate, ... })
const GrpcRequestSchema = z.object({
  kind: z.literal('grpc'),
  service: z.string(),                    // e.g. "cwgame.WalletService"
  method: z.string(),                     // e.g. "GetBalance"
  target: z.string(),                     // host:port — usually env-templated
  protoset: z.string(),                   // base64-encoded compiled descriptors,
                                          // OR a docs[] key pointing to the source .proto
  requestTemplate: z.unknown().optional(),
  metadata: z.record(z.string(), z.string()).optional(),
  tls: z.object({ enabled: z.boolean(), insecure: z.boolean().optional() }).optional(),
})
const RequestSchema = z.discriminatedUnion('kind', [HttpRequestSchema, GrpcRequestSchema])
```

Backward compat: HTTP requests must keep working without `kind`. Add a runtime
migration that defaults to `kind: 'http'` when missing.

## Implementation order (3 PRs)

1. **PR A — shared `grpc/` module + proto importer + tests** (~3 days)
   No web changes. Pure shared work. Land green tests.

2. **PR B — bundle schema bump (discriminated request) + CLI plumbing** (~2 days)
   Update bundle schema + add `rb import proto` and `rb run` support for grpc
   kind. Ship a fixture bundle with one grpc block.

3. **PR C — web app: ProtoImportPanel + grpc block run UI + result panel** (~4 days)
   Mirrors the HTTP block UX. Show service/method instead of method/URL.
   Response panel reuses the existing JSON viewer.

## Open questions to resolve during PR A

- **Compiled protoset vs raw .proto in bundle.** Compiled (`.pb`) is smaller and
  doesn't need a runtime proto-loader, but loses round-trip readability.
  Recommendation: store **both** — `protoset` as the source of truth for
  execution, plus the source `.proto` text in `docs[]` for human review.

- **Browser support.** `@grpc/grpc-js` is Node-only. The browser cannot speak
  raw HTTP/2 to a gRPC server. Options:
  - (a) Require a local sidecar (`rb proxy grpc`) to bridge — clean but extra step.
  - (b) Support **gRPC-Web** in the browser via `grpc-web` client. Many gRPC
    servers don't speak it without an Envoy in front.
  - (c) **Browser shows "Run via CLI" badge** for grpc blocks — works on day one.
  
  **Recommendation:** ship (c) first, then add (a) as `rb proxy grpc --port 7333`.

## Risk register

- proto-loader pulls in 2MB of deps — gate behind `optionalDependencies` so the
  web build doesn't bloat for users who never touch gRPC.
- TLS config in proto files (Google-style) needs special handling — document
  what we ignore.
- Reflection-based discovery (no `.proto` file needed) is the **future v2**
  feature; design the resolver so reflection can plug in later.

## Acceptance criteria

- [ ] User can `rb import proto path/to/cwgame_api.proto`, get a bundle.
- [ ] CLI `rb run bundle.json grpc-smoke` executes a unary RPC against a
      reachable gRPC server and prints the response.
- [ ] Web app renders the block; clicking "Run" shows a "Run via CLI" banner
      with a copy-paste command.
- [ ] All existing HTTP blocks continue to work (regression test suite green).
- [ ] No new lint failures.
