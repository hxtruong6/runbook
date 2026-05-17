# Runbook — Feature Roadmap

The 20-item growth roadmap (Wave 1-3) is shipped — see
[`growth-roadmap.md`](./growth-roadmap.md) for status. This file tracks
the **next backlog**: features beyond that initial roadmap, with
written plans in [`./plans/`](./plans/).

Ordered by priority (impact first, then plan-readiness).

| # | Feature | Status | Effort | Plan |
|---|---|---|---|---|
| 1 | **Hierarchical grouping & tag filter** | 📋 Plan ready | ~3 days | [plans/hierarchical-grouping.md](./plans/hierarchical-grouping.md) |
| 2 | **Self-documenting bundles** (persist inference + per-block / per-collection markdown) | 📋 Plan ready | ~5 days | [plans/self-documenting-bundles.md](./plans/self-documenting-bundles.md) |
| 3 | **gRPC support** (`.proto` → blocks + fetcher) | 📋 Plan ready | ~9 days | [plans/grpc-support.md](./plans/grpc-support.md) |
| 4 | **Source scanner** (NestJS / Express → blocks without running the server) | 📋 Plan ready | ~9 days | [plans/source-scanner.md](./plans/source-scanner.md) |
| 5 | **Webhook replay** (paste payload, re-sign, replay to local) | 📋 Plan ready | ~3 days | [plans/webhook-replay.md](./plans/webhook-replay.md) |

## Still pending from the original growth roadmap

| # | Feature | Status |
|---|---|---|
| F5 | Browser extension: capture from network tab | ⏳ Wave 4 |
| F9 | AI block generation from natural language | ⏳ Wave 4 |

## Rationale for the ordering

1. **Hierarchical grouping first** — cheapest, unblocks every bundle
   with more than ~30 blocks. Without it, large imports (cworld-be has
   200+) are unusable.
2. **Self-documenting bundles next** — schema inference already runs
   on every block execution, but the data never leaves localStorage.
   Persisting it into the bundle (plus markdown descriptions) turns
   every bundle into living documentation — the core moat vs Postman.
3. **gRPC** — opens segments (fintech, gaming, infra) where current
   tooling is poor. Larger investment, ship after the HTTP UX is solid.
4. **Source scanner** — complements OpenAPI import (F2, shipped). Wins
   for repos with sparse `@ApiOperation` decorators and for CI use.
5. **Webhook replay** — niche but well-scoped. Defer until a real user
   request lands.

Quick-win adjacent: **auto-discover endpoint** (probe
`/documentation-json`, `/swagger.json`, `/openapi.json`, gRPC reflection
from a base URL). One day of work, demo-friendly — ship alongside
self-documenting-bundles.
