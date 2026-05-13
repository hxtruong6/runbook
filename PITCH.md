# Runbook — Investor Pitch

**One-line:** Runbook is `package.json` + `npm` for API workflows — a versioned, runnable bundle format that lets API providers ship integrations to their customers as a single signed artifact, and lets platform teams replace fragmented Postman/Bruno usage with one source of truth.

**Stage:** Pre-seed. Working product, public repo, design-partner conversations open.

**Contact:** Xuan Truong — [hxtruong6@gmail.com](mailto:hxtruong6@gmail.com)

---

## 1. The problem

Every company that ships or consumes an API rebuilds the same fragmented stack:

- A Postman/Bruno collection that nobody trusts is current.
- A Notion page of curl commands that rots silently.
- A Python or TypeScript script in a dusty repo that one engineer maintains.
- A partner integration that breaks the next time the API changes — and nobody notices for a week.

**There is no versioned, executable, distributable artifact that says "here is exactly how to use this API, today, and how it differs from last month."** OpenAPI describes the surface. Postman explores it. Neither *ships* a working integration.

The downstream cost is real:

- **Integration onboarding** takes 2–6 weeks at most API-first companies.
- **Partner churn** spikes after breaking changes that consumers don't discover until production.
- **Internal duplication** — every team has its own private collection of "how to call our own APIs."

## 2. The solution

Runbook introduces three primitives and one artifact:

1. **API Block** — a typed, reusable HTTP request template (inputs → request → outputs).
2. **Scenario** — an ordered or graph-based composition of blocks, with branching and context passing.
3. **Environment** — base URL + auth, swappable in one click.
4. **Bundle** — a single `.json` file containing every version of a project. Semver-aware. Self-contained. Distributable.

A provider authors a bundle once. Consumers import it, get every version of every flow, can run them in a browser with zero setup, and can switch versions to see exactly what changed. When the provider ships v2.1, consumers get a new bundle — diffs are explicit, not implicit.

## 3. Why now

- **API surface explosion.** AI agents, MCP, and LLM-driven workflows have made "an API call" the unit of work across the stack. The number of integrations a typical company maintains has roughly doubled in three years.
- **OpenAPI is necessary but insufficient.** OpenAPI describes endpoints; it does not describe *workflows*. Arazzo (the OpenAPI workflow spec, 2024) confirms the industry sees the gap — Runbook is the runtime.
- **Postman's strategic drift.** Postman's pivot toward an opinionated SaaS suite has created room for an open, portable, version-first alternative.
- **AI agents need executable contracts.** An agent calling a third-party API needs a machine-readable, executable description of a flow — not English docs, not a raw OpenAPI spec. Bundles are exactly that.

## 4. Market

| Segment | Who | Wedge |
|---|---|---|
| **API-first providers** | Stripe-shaped fintechs, dev-infra companies, AI platforms | Ship a Runbook bundle alongside your SDK. Cut integration time for enterprise customers from weeks to days. |
| **Internal platform teams** | Series B+ companies with 20+ internal services | Replace fragmented Postman/Bruno. One versioned source of truth across the org. |
| **AI agent builders** | Companies wiring LLMs to real-world APIs | Bundles as the tool surface — typed, versioned, executable. Native MCP integration on the roadmap. |

**Market size.** Gartner sizes the API management market at ~$6.8B in 2024, projected to exceed $13B by 2027 (~20% CAGR). Runbook plays in the underserved **API consumption** half of that market — the half that existing leaders (Apigee, Kong, Postman) only partially address.

## 5. Product status

Live in the repo today:

- Browser-first React runtime, no backend required for solo use
- Versioned project bundles with semver-aware switcher
- Graph mode with ok/error branching
- Reusable scenarios (embed scenarios inside scenarios)
- Multi-environment support (bearer, cookie, API key, basic auth)
- Optional Fastify + Socket.io backend for multi-user / persistent runs
- Shared Zod schemas — one source of truth across web and server
- Design system locked behind ESLint (no hex literals, no off-palette colors)

## 6. Roadmap

| Quarter | Milestone |
|---|---|
| Now | Bundle signing + a public registry (`runbook publish` / `runbook install`) |
| Next | OpenAPI → blocks importer; one-click adoption for any documented API |
| +1 | Hosted team workspaces (RBAC, audit, run history) |
| +2 | MCP integration: expose any bundle as a tool surface for AI agents |
| Enterprise | SOC 2, SSO, audit logs, self-hosted deploys |

## 7. Business model

- **Open core.** The runtime and bundle format stay open and free forever.
- **Team SaaS** ($X/user/month). Hosted workspaces, RBAC, run history, secret management.
- **Enterprise.** Self-hosted, SSO, audit, support SLA.
- **Registry.** Eventual marketplace fees for verified third-party bundles.

GTM is bottoms-up developer adoption (open repo, npm-installable CLI, design-partner programs with 3–5 API-first companies) followed by team SaaS expansion inside those accounts.

## 8. Why us

- Hands-on experience building developer-facing platforms.
- Working product shipped solo in weeks — capital efficiency demonstrated.
- Already operating with engineering discipline that scales: monorepo, shared schemas, locked design system, lint-enforced conventions.

## 9. Traction

- Public repo: <https://github.com/hxtruong6/runbook>
- Live product running locally with versioned bundles, graph mode, and backend
- Design-partner conversations: open

*(Add specific star counts, pilot logos, weekly active runs as they accumulate.)*

## 10. The ask

Raising a **pre-seed round** to:

1. Convert 3–5 design partners into paying customers.
2. Ship the registry + bundle signing.
3. Build the OpenAPI importer (the biggest wedge for distribution).

If you fund or partner with developer-tools companies — let's talk.

**[hxtruong6@gmail.com](mailto:hxtruong6@gmail.com)**
