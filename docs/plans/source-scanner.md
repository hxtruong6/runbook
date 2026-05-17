# Plan — Source scanner (NestJS / Express → blocks)

**Goal:** Import a block library by reading the **backend's source code**
directly — no need to run the server, no need for a Swagger endpoint to be
wired up. Drop a path to a NestJS or Express repo and get one block per
route, with inputs derived from decorators and DTOs.

Motivating case in cworld-be: `@ApiOperation` decorators are sparse so the
runtime Swagger spec is thin, but the controllers themselves declare
route + params + DTOs with `class-validator` rules. The source is the
richer source of truth.

## Why this beats the OpenAPI importer (which already exists)

| Path | Pros | Cons |
|---|---|---|
| OpenAPI (F2, shipped) | Works for any language. | Needs server running + Swagger wired. Quality depends on `@ApiOperation` coverage. |
| **Source scanner (this plan)** | Zero-config when decorators are present. CI-friendly (no boot). Picks up DTO `class-validator` rules OpenAPI often omits. | TS/JS only. One scanner per framework. |

Treat this as complementary, not a replacement.

## Frameworks supported in v1

- **NestJS** — `@Controller`, `@Get`/`@Post`/etc., `@Body`/`@Query`/`@Param`,
  DTOs with `class-validator` decorators, `@ApiOperation`/`@ApiResponse`
  if present.
- **Express** — `app.get('/path', handler)`, `router.post(...)`, including
  the common `express-validator` and `joi` body-schema patterns.

Fastify, Koa, Hono — v2.

## File layout

```
packages/shared/src/import/source-scanner/
├─ index.ts                              Barrel — exports scanDirectory()
├─ types.ts                              ScannedRoute, ScannerOptions, ScanResult
├─ scanner.ts                            scanDirectory(path, opts):
│                                          - detect framework
│                                          - delegate to nest/express
│                                          - return ScannedRoute[]
├─ frameworks/
│  ├─ nest.ts                            ts-morph walker over *.controller.ts
│  │                                       parses @Controller prefix, method
│  │                                       decorators, param decorators, DTOs
│  ├─ express.ts                         Walks route registration patterns
│  └─ shared.ts                          DTO class → InputSpec[] resolution
│                                         (handles class-validator decorators)
│
└─ mapper.ts                             ScannedRoute[] → BlockDefData[]
                                          reuses existing openapi.ts mapper
                                          where shapes overlap

packages/shared/tests/import/source-scanner/
├─ fixtures/
│  ├─ nest-simple/                       Tiny Nest controller fixture
│  ├─ nest-with-dtos/                    Controller + DTOs + validators
│  ├─ nest-cworld-subset/                Excerpt from cworld-be
│  └─ express-basic/                     Express router fixture
├─ scanner.test.ts                       Framework detection
├─ frameworks/nest.test.ts               Per-decorator coverage
├─ frameworks/express.test.ts
└─ mapper.test.ts                        Round-trip ScannedRoute → BlockDefData

packages/cli/src/commands/
└─ import.ts                             CHANGE: add subcommand
                                            `rb import source <path> [--framework nest|express|auto]`

apps/web/src/features/import/
├─ SourceImportPanel.tsx                 NEW: directory picker (uses File
│                                              System Access API where
│                                              available; falls back to
│                                              zip upload)
└─ scanResultPreview.tsx                 NEW: list of detected routes with
                                              accept/discard checkboxes

docs/
└─ source-scanner.md                     NEW: end-user docs
```

## Dependencies

- `ts-morph` (~3MB) — TypeScript AST walker. Used in shared package, gated
  behind a dynamic import so it doesn't bloat the web bundle for users who
  never scan.
- No new runtime deps in `apps/web` — the scanner runs in a worker via
  dynamic import when invoked.

## What gets extracted per framework

### NestJS (per controller method)

| Source | Becomes |
|---|---|
| `@Controller('users')` + `@Get(':id')` | Block URL: `GET /users/:id` |
| `@Param('id') id: string` | Input `id`, type=string, location=path, required=true |
| `@Query('limit') limit?: number` | Input `limit`, type=number, location=query, required=false |
| `@Body() dto: CreateUserDto` | Inputs derived from `CreateUserDto` fields + their `class-validator` rules (`@IsEmail` → format, `@IsOptional` → required=false, `@MinLength(8)` → placeholder hint) |
| `@ApiOperation({ summary })` | Block description (markdown) |
| `@ApiResponse({ status: 200, type: UserDto })` | Inference seed: 2xx schema from `UserDto` shape (no actual run required) |
| Method JSDoc `/** ... */` | Appended to description if present |
| Controller filename (`admin/users.controller.ts`) | Tags: `['admin']` — feeds the hierarchical-grouping plan |

### Express (per route registration)

| Source | Becomes |
|---|---|
| `router.get('/users/:id', ...)` | Block URL + method |
| URL `:id` segment | Input `id`, location=path |
| `body('email').isEmail()` (express-validator) | Input `email`, format=email |
| `Joi.object({ ... })` or `z.object({ ... })` near the handler | Inputs derived from schema |
| `// @description ...` leading comment | Block description |

## Edge cases

- **Inheritance**: `class CreateAdminUserDto extends CreateUserDto` — walk
  the parent chain, merge fields. Conflicts: child wins.
- **Generics**: `@Body() dto: PaginatedRequest<UserFilter>` — try to
  resolve the type argument; if unresolvable, fall back to `unknown`.
- **Dynamic routes** (string concat, function-built paths) — emit a
  warning, skip the route.
- **Multiple decorators on one handler** (`@Get('/a') @Get('/b')`) —
  emit one block per concrete path.
- **Guards/Interceptors**: `@UseGuards(JwtAuthGuard)` → set `auth: 'jwt'`
  on the block. Recognize Nest's common guard names; document the
  convention list.

## Re-running on a path

`rb import source <path>` is idempotent against an existing bundle:

- Match scanned routes to existing blocks by `method + urlTemplate`.
- New routes → added (highlighted in preview).
- Disappeared routes → marked deprecated (not deleted — author decides).
- Changed input set → diff shown per block.

This is the path to **CI use**: a job that re-scans on PR and posts a diff
comment for any block-surface change.

## Out of scope (v1)

- Python frameworks (FastAPI, Django) — v2. The mapper layer is
  framework-agnostic so adding one is mostly a new walker.
- Runtime evaluation of dynamic decorators (e.g. decorator factories that
  compute paths at runtime).
- gRPC scanning of Nest microservices — covered separately by the
  `grpc-support` plan via the `.proto` file.
- Webhook controllers as a special block kind — covered by
  `webhook-replay`. The scanner just emits them as normal HTTP blocks.

## Implementation order (3 PRs)

1. **PR A — Nest scanner + mapper + tests** (~4 days)
   Pure shared work. ts-morph walker. Fixtures including a cworld-be
   subset. No UI, no CLI. Verifiable via tests.

2. **PR B — CLI subcommand + Express scanner** (~3 days)
   Add `rb import source <path>`. Add Express walker. Write the
   re-import-against-existing-bundle diff logic. Ship a CI example in
   docs.

3. **PR C — Web import panel** (~2 days)
   Directory picker → run scanner in a worker → preview list →
   commit selected routes into a bundle. Same UX as existing
   OpenAPI / Postman import panels.

## Acceptance criteria

- [ ] Pointing the CLI at a Nest repo containing 10 controllers
      produces a bundle with one block per HTTP method on each.
- [ ] DTO fields with `@IsEmail`, `@IsOptional`, `@MinLength`
      decorators come through as inputs with the right shape and
      required flag.
- [ ] `@ApiOperation({ summary })` populates the block `description`
      (depends on the `self-documenting-bundles` plan landing first
      OR add a placeholder until it does).
- [ ] `@ApiResponse({ status: 200, type: SomeDto })` seeds
      `block.inference.schemas['2xx']` without any runs.
- [ ] Re-scanning a directory against an existing bundle produces an
      added/removed/changed diff, not a wipe.
- [ ] An Express fixture using `express-validator` produces correct
      inputs.
- [ ] The web bundle size does not change when the source scanner is
      not invoked (verify via dynamic import boundary).
- [ ] No new lint failures.

## Risks

- **ts-morph version drift**: pin the TypeScript version it ships with.
  Document the supported TS range. If user's tsconfig uses very new
  syntax, fall back gracefully (skip + warn).
- **False sense of completeness**: a scanned bundle looks "done" but the
  underlying API may have hidden middleware quirks. Show a banner on
  first open: "Generated from source. Run each block once to capture
  real responses." This pairs perfectly with the inference work.
- **DTO resolution cost on large repos**: cap recursion depth at 5,
  cache resolved classes per scan.
